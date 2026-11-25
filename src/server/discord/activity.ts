import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { auth } from "@/lib/auth";
import type { Role } from "@/lib/domain";
import { env } from "@/lib/env";
import { canSeeBoard, type BoardAccess } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";
import { ActivityInstance } from "@/models/activity-instance";
import { ActivitySession } from "@/models/activity-session";
import { connectToDatabase, toObjectId } from "@/server/queries/shared";

/** L'activité Discord du hub.
 *
 *  Discord ouvre le hub dans une iframe, derrière son proxy : le cookie du site
 *  n'y vit pas. Un participant s'y présente donc par le code que lui donne le
 *  SDK, que le serveur échange contre son identité Discord. De là :
 *
 *  - il reçoit un **laissez-passer** d'instance (`ActivityPass`), signé ici :
 *    il dit « ce compte Discord est dans cette instance », vérifié auprès de
 *    Discord par le jeton du bot. C'est lui qui ouvre en lecture le panneau
 *    que l'instance montre, compte du hub ou non. Il est court et se renouvelle
 *    en rejouant la présence (`/api/discord/renouveler`) : qui quitte le salon
 *    cesse de lire son panneau au renouvellement suivant ;
 *  - si son compte Discord est lié à un compte du hub, il reçoit aussi une
 *    session, que l'activité représente en `Authorization: Bearer` comme
 *    l'application bureau. Les droits d'écriture sont alors ceux du site. */

const DISCORD_API = "https://discord.com/api/v10";

/** Un laissez-passer vaut un quart d'heure ; l'activité le renouvelle avant. */
const PASS_MS = 15 * 60 * 1000;
/** Une instance oubliée s'efface une semaine après son dernier changement. */
const INSTANCE_MS = 7 * 24 * 60 * 60 * 1000;

export class ActivityError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function activityConfigured(): boolean {
  return Boolean(env.discordClientId && env.discordClientSecret && env.discordBotToken);
}

/* --- Discord ------------------------------------------------------------- */

export type DiscordUser = { id: string; username: string; globalName: string | null; avatar: string | null };

/** Échange le code du SDK contre le jeton d'accès du participant. L'activité
 *  n'a pas d'adresse de retour : Discord n'en demande pas ici. */
export async function exchangeDiscordCode(code: string): Promise<string> {
  const response = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.discordClientId,
      client_secret: env.discordClientSecret,
      grant_type: "authorization_code",
      code,
    }),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as { access_token?: string } | null;
  if (!response.ok || !body?.access_token) {
    throw new ActivityError("Discord n'a pas confirmé votre identité.", 401);
  }
  return body.access_token;
}

export async function readDiscordUser(accessToken: string): Promise<DiscordUser> {
  const response = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as
    | { id?: string; username?: string; global_name?: string | null; avatar?: string | null }
    | null;
  if (!response.ok || !body?.id) throw new ActivityError("Discord n'a pas confirmé votre identité.", 401);
  return {
    id: body.id,
    username: body.username ?? "",
    globalName: body.global_name ?? null,
    avatar: body.avatar ?? null,
  };
}

/** Ce compte Discord est-il dans cette instance de l'activité ? Discord le dit
 *  au bot de l'application ; un identifiant d'instance recopié d'ailleurs ne
 *  suffit pas à lire le panneau d'un salon où l'on n'est pas. */
export async function isInInstance(instanceId: string, discordId: string): Promise<boolean> {
  const response = await fetch(
    `${DISCORD_API}/applications/${env.discordClientId}/activity-instances/${encodeURIComponent(instanceId)}`,
    { headers: { Authorization: `Bot ${env.discordBotToken}` }, cache: "no-store" },
  );
  if (response.status === 404) return false;
  if (!response.ok) throw new ActivityError("Discord ne répond pas : réessayez dans un instant.", 502);
  const body = (await response.json().catch(() => null)) as { users?: string[] } | null;
  return Boolean(body?.users?.includes(discordId));
}

/* --- Le compte du hub ---------------------------------------------------- */

/** Le compte du hub lié à ce compte Discord, et une session pour lui. La
 *  session est courte (`dontRememberMe`), et l'activité n'en garde qu'une par
 *  compte : la précédente est révoquée, sinon chaque lancement en laisserait
 *  une ouverte. */
export async function openLinkedSession(
  discordId: string,
): Promise<{ token: string; user: { id: string; name: string } } | null> {
  const context = await auth.$context;
  const owner = await context.internalAdapter.findAccountOwnerByKey({
    providerId: "discord",
    accountId: discordId,
  });
  if (!owner || owner.kind !== "owned") return null;
  await connectToDatabase();
  const previous = (await ActivitySession.findOne({ userId: owner.user.id } as never).lean()) as
    | { token?: string }
    | null;
  if (previous?.token) await context.internalAdapter.deleteSession(previous.token);
  const session = await context.internalAdapter.createSession(owner.user.id, true);
  await ActivitySession.updateOne(
    { userId: owner.user.id } as never,
    { $set: { token: session.token, expiresAt: session.expiresAt } } as never,
    { upsert: true },
  );
  return { token: session.token, user: { id: owner.user.id, name: owner.user.name } };
}

/** Un compte du hub tel que les règles d'accès le lisent. */
async function sessionUserById(userId: string): Promise<SessionUser | null> {
  const context = await auth.$context;
  const user = (await context.internalAdapter.findUserById(userId)) as
    | (Record<string, unknown> & { id: string; name: string; email: string; image?: string | null })
    | null;
  if (!user) return null;
  const suspended = user.suspendedUntil as Date | string | null | undefined;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    role: ((user.role as string | undefined) ?? "membre") as Role,
    suspendedUntil: suspended ? new Date(suspended) : null,
  };
}

/* --- Le laissez-passer --------------------------------------------------- */

export type ActivityPass = { instanceId: string; discordId: string; expiresAt: number };

function signature(payload: string): Buffer {
  return createHmac("sha256", `${env.betterAuthSecret}:activite-discord`).update(payload).digest();
}

export function signPass(instanceId: string, discordId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ i: instanceId, d: discordId, e: Date.now() + PASS_MS }),
  ).toString("base64url");
  return `${payload}.${signature(payload).toString("base64url")}`;
}

export function readPass(raw: string | null | undefined): ActivityPass | null {
  if (!raw) return null;
  const [payload, mac] = raw.split(".");
  if (!payload || !mac) return null;
  const expected = signature(payload);
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      i?: unknown;
      d?: unknown;
      e?: unknown;
    };
    if (typeof parsed.i !== "string" || typeof parsed.d !== "string" || typeof parsed.e !== "number") {
      return null;
    }
    if (parsed.e < Date.now()) return null;
    return { instanceId: parsed.i, discordId: parsed.d, expiresAt: parsed.e };
  } catch {
    return null;
  }
}

/* --- Le panneau de l'instance -------------------------------------------- */

async function instanceBoard(instanceId: string): Promise<{ boardId: string; setBy: string } | null> {
  await connectToDatabase();
  const found = (await ActivityInstance.findOne({ instanceId } as never)
    .select({ boardId: 1, setBy: 1 })
    .lean()) as { boardId?: unknown; setBy?: string } | null;
  return found?.boardId && found.setBy ? { boardId: String(found.boardId), setBy: found.setBy } : null;
}

export async function setInstanceBoard(instanceId: string, boardId: string, userId: string): Promise<void> {
  await connectToDatabase();
  const id = toObjectId(boardId);
  if (!id) throw new ActivityError("Ce panneau n'existe plus.", 404);
  await ActivityInstance.updateOne(
    { instanceId } as never,
    { $set: { boardId: id, setBy: userId, expiresAt: new Date(Date.now() + INSTANCE_MS) } } as never,
    { upsert: true },
  );
}

/** Ce que le laissez-passer ouvre en lecture : le panneau que son instance
 *  montre en ce moment, et le compte qui l'y a posé. */
export type ActivityReadGrant = { boardId: string; setter: SessionUser | null };

export async function activityReadGrant(rawPass: string | null): Promise<ActivityReadGrant | null> {
  const pass = readPass(rawPass);
  if (!pass) return null;
  const found = await instanceBoard(pass.instanceId);
  if (!found) return null;
  return { boardId: found.boardId, setter: await sessionUserById(found.setBy) };
}

/** L'accord ouvre-t-il ce panneau ? Seulement celui que l'instance montre —
 *  changer de panneau referme l'ancien —, et seulement tant que celui qui l'a
 *  posé **peut** encore le lire : retiré du groupe, ou le panneau passé aux
 *  membres, le salon cesse de le lire avec lui. */
export function activityGrantsBoard(
  grant: ActivityReadGrant | null,
  boardId: string,
  access: BoardAccess,
): boolean {
  return grant !== null && grant.boardId === boardId && canSeeBoard(grant.setter, access);
}
