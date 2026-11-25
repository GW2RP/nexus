import "server-only";

import { auth } from "@/lib/auth";

/** Le lien Discord de ce compte du hub — l'identifiant du lien chez Better
 *  Auth, qui sert à le défaire —, ou `null`. */
export async function linkedDiscordId(userId: string): Promise<string | null> {
  const context = await auth.$context;
  const accounts = await context.internalAdapter.findAccounts(userId);
  return accounts.find((account) => account.providerId === "discord")?.id ?? null;
}
