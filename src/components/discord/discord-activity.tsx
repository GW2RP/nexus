"use client";

import { DiscordSDK, patchUrlMappings } from "@discord/embedded-app-sdk";
import { useCallback, useEffect, useState } from "react";

import { BoardEditor } from "@/components/board/board-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { BOARD_OWNER_LABELS, type ActivityBoard, type PickableBoard } from "@/lib/discord-activity";

/** L'activité Discord du hub : le panneau qu'un salon regarde ensemble.
 *
 *  Discord sert la page derrière son proxy, sur `<application>.discordsays.com`
 *  et sous une CSP qui refuse tout autre hôte. Le hub y est donc joint par des
 *  adresses relatives, et les deux hôtes extérieurs dont le panneau a besoin —
 *  les images du magasin, et l'envoi d'une image — par les correspondances du
 *  portail (`/stockage`, `/vercel-blob`), que `patchUrlMappings` applique aux
 *  requêtes et aux `src`.
 *
 *  Le cookie du site n'existe pas ici. L'entrée (`/api/discord/connexion`)
 *  rend un laissez-passer d'instance, et une session quand le compte Discord
 *  est lié au hub : tous deux partent en en-têtes sur chaque requête vers le
 *  hub, actions serveur comprises (`withActivityHeaders`). */

type Session = { token: string; user: { id: string; name: string } };

type Entry = {
  accessToken: string;
  laissezPasser: string;
  discord: { id: string; nom: string };
  session: Session | null;
};

type Participant = { id: string; name: string };

type Phase =
  | { step: "connexion" }
  | { step: "hors-discord" }
  | { step: "erreur"; message: string }
  | { step: "prete"; entry: Entry; sdk: DiscordSDK };

/** Le suivi du panneau de l'instance : un autre participant a pu en changer. */
const FOLLOW_MS = 5000;

/** Chaque requête vers le hub porte le laissez-passer, et la session s'il y en
 *  a une. Une requête vers un autre hôte n'en voit rien. */
function withActivityHeaders(pass: string, token: string | null) {
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = input instanceof Request ? input.url : String(input);
    const url = new URL(raw, window.location.href);
    if (url.origin !== window.location.origin || url.pathname.startsWith("/.proxy/")) {
      return original(input, init);
    }
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set("x-activite", pass);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return original(input instanceof Request ? new Request(input, { headers }) : input, { ...init, headers });
  };
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as (T & { erreur?: string }) | null;
  if (!response.ok || !body) throw new Error(body?.erreur ?? "Le hub ne répond pas.");
  return body;
}

export function DiscordActivity({
  clientId,
  blobHost,
  inDiscord,
}: {
  clientId: string;
  blobHost: string;
  /** Discord a ouvert la page : sa requête porte `frame_id`. */
  inDiscord: boolean;
}) {
  const [phase, setPhase] = useState<Phase>(
    inDiscord && clientId ? { step: "connexion" } : { step: "hors-discord" },
  );
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    if (!inDiscord || !clientId) return;
    // La racine a été réécrite vers l'activité : l'adresse le dit, pour que
    // les actions serveur partent vers la bonne page.
    if (window.location.pathname !== "/discord") {
      window.history.replaceState(null, "", `/discord${window.location.search}`);
    }

    const mappings = [{ prefix: "/vercel-blob", target: "vercel.com" }];
    if (blobHost) mappings.push({ prefix: "/stockage", target: blobHost });
    patchUrlMappings(mappings, { patchFetch: true, patchXhr: true, patchSrcAttributes: true });

    let cancelled = false;
    const sdk = new DiscordSDK(clientId);

    function onParticipants(data: { participants: { id: string; username: string; global_name?: string | null; nickname?: string }[] }) {
      setParticipants(
        data.participants.map((one) => ({ id: one.id, name: one.nickname || one.global_name || one.username })),
      );
    }

    (async () => {
      try {
        await sdk.ready();
        const { code } = await sdk.commands.authorize({
          client_id: clientId,
          response_type: "code",
          state: "",
          prompt: "none",
          scope: ["identify"],
        });
        const entry = await readJson<Entry>(
          await fetch("/api/discord/connexion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, instanceId: sdk.instanceId }),
          }),
        );
        await sdk.commands.authenticate({ access_token: entry.accessToken });
        if (cancelled) return;
        withActivityHeaders(entry.laissezPasser, entry.session?.token ?? null);
        setPhase({ step: "prete", entry, sdk });

        onParticipants(await sdk.commands.getInstanceConnectedParticipants());
        await sdk.subscribe("ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE", onParticipants);
      } catch (error) {
        if (!cancelled) {
          setPhase({
            step: "erreur",
            message: error instanceof Error ? error.message : "La connexion à Discord a échoué.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId, blobHost, inDiscord]);

  if (phase.step === "hors-discord") {
    return (
      <main id="contenu" className="mx-auto max-w-[720px] px-gutter-mobile py-16">
        <EmptyState title="Cette page s'ouvre depuis une activité Discord" />
      </main>
    );
  }
  if (phase.step === "connexion") {
    return (
      <main id="contenu" className="flex h-dvh items-center justify-center bg-surface">
        <p className="meta text-ink-muted" role="status">
          Connexion à Discord…
        </p>
      </main>
    );
  }
  if (phase.step === "erreur") {
    return (
      <main id="contenu" className="mx-auto max-w-[720px] px-gutter-mobile py-16">
        <EmptyState title={phase.message} />
      </main>
    );
  }
  return <ActivityBoardScreen entry={phase.entry} participants={participants} sdk={phase.sdk} />;
}

function ActivityBoardScreen({
  entry,
  participants,
  sdk,
}: {
  entry: Entry;
  participants: Participant[];
  sdk: DiscordSDK;
}) {
  const [board, setBoard] = useState<ActivityBoard | null | undefined>(undefined);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const me = entry.session?.user ?? null;

  const load = useCallback(
    () =>
      fetch("/api/discord/instance")
        .then((response) => readJson<{ panneau: ActivityBoard | null }>(response))
        .then(({ panneau }) => {
          setBoard(panneau);
          setError(null);
        })
        .catch((failure: unknown) => {
          setError(failure instanceof Error ? failure.message : "Le hub ne répond pas.");
        }),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Un autre participant a pu poser un autre panneau : on ne relit que son
  // identifiant, et le panneau entier seulement s'il a changé.
  const currentId = board?.id ?? null;
  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const { panneauId } = await readJson<{ panneauId: string | null }>(
          await fetch("/api/discord/instance?suivi", { cache: "no-store" }),
        );
        if (panneauId !== currentId) void load();
      } catch {
        // La relecture suivante réessaie.
      }
    }, FOLLOW_MS);
    return () => clearInterval(timer);
  }, [currentId, load]);

  async function choose(id: string) {
    try {
      const { panneau } = await readJson<{ panneau: ActivityBoard }>(
        await fetch("/api/discord/instance", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ panneau: id }),
        }),
      );
      setBoard(panneau);
      setPicking(false);
      setError(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Ce panneau n'a pas pu être posé.");
    }
  }

  function openOnHub(path: string) {
    void sdk.commands.openExternalLink({ url: `https://www.gw2rp.eu${path}` });
  }

  const choosing = me !== null && (picking || board === null);

  return (
    <div className="flex h-dvh flex-col bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b-2 border-rule px-gutter-mobile py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
          {board ? (
            <>
              <h1 className="panel-title">{board.name}</h1>
              <span className="meta text-ink-muted">
                {BOARD_OWNER_LABELS[board.ownerType]} · {board.ownerName}
              </span>
            </>
          ) : (
            <h1 className="panel-title">GW2RP Nexus</h1>
          )}
          {board && !board.canWrite ? <Badge variant="outline">LECTURE SEULE</Badge> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {participants.length > 0 ? (
            <span className="meta text-ink-muted" title={participants.map((one) => one.name).join(", ")}>
              {participants.length} {participants.length > 1 ? "participants" : "participant"}
            </span>
          ) : null}
          {me && board ? (
            <Button variant="outline" size="sm" onClick={() => setPicking((open) => !open)} aria-expanded={picking}>
              {picking ? "GARDER CE PANNEAU" : "CHANGER DE PANNEAU"}
            </Button>
          ) : null}
          {!me ? (
            <Button variant="outline" size="sm" onClick={() => openOnHub("/mon-compte")}>
              LIER MON COMPTE DISCORD
            </Button>
          ) : null}
          {board ? (
            <Button variant="quiet" size="sm" onClick={() => openOnHub(board.path)}>
              OUVRIR SUR LE HUB
            </Button>
          ) : null}
        </div>
      </header>

      {error ? (
        <p role="alert" className="border-b border-rule px-gutter-mobile py-2 meta text-crimson-ink">
          {error}
        </p>
      ) : null}

      <div className="min-h-0 flex-1">
        {choosing ? (
          <BoardPicker currentId={board?.id ?? null} onChoose={choose} />
        ) : board === undefined ? null : board === null ? (
          <div className="px-gutter-mobile py-8">
            <EmptyState title="Aucun panneau sur l'activité" />
          </div>
        ) : (
          <BoardEditor
            key={board.id}
            boardId={board.id}
            initialContent={board.content}
            initialRevision={board.revision}
            ownerType={board.ownerType}
            me={me}
            canWrite={board.canWrite}
            canModerate={board.canModerate}
            canReport={board.canReport}
            facts={[
              { label: BOARD_OWNER_LABELS[board.ownerType], value: board.ownerName },
              { label: "Discord", value: entry.discord.nom },
            ]}
          />
        )}
      </div>
    </div>
  );
}

/** Les panneaux qu'on peut poser sur l'activité : ceux de ses groupes et de
 *  ses lieux. Tout le salon verra celui qu'on choisit. */
function BoardPicker({ currentId, onChoose }: { currentId: string | null; onChoose: (id: string) => void }) {
  const [boards, setBoards] = useState<PickableBoard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { panneaux } = await readJson<{ panneaux: PickableBoard[] }>(await fetch("/api/discord/panneaux"));
        setBoards(panneaux);
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "Le hub ne répond pas.");
      }
    })();
  }, []);

  return (
    <section aria-labelledby="choisir-panneau" className="mx-auto max-w-[720px] px-gutter-mobile py-8">
      <h2 id="choisir-panneau" className="section-title mb-4">
        Choisir un panneau
      </h2>
      {error ? <p role="alert" className="meta text-crimson-ink">{error}</p> : null}
      {boards === null ? null : boards.length === 0 ? (
        <EmptyState title="Aucun panneau dans vos groupes ni vos lieux" />
      ) : (
        <ul className="border-t border-hairline">
          {boards.map((one) => (
            <li key={one.id} className="border-b border-hairline">
              <button
                type="button"
                onClick={() => onChoose(one.id)}
                aria-current={one.id === currentId ? "true" : undefined}
                className="flex min-h-tap w-full flex-wrap items-baseline justify-between gap-x-4 px-2 py-3 text-left hover:bg-surface-selected focus-visible:outline-2 focus-visible:outline-gold"
              >
                <span className="card-title">{one.name}</span>
                <span className="meta text-ink-muted">
                  {BOARD_OWNER_LABELS[one.ownerType]} · {one.ownerName}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
