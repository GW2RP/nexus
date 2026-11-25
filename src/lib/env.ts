/** Accès centralisé aux variables d'environnement, avec un message clair si l'une manque. */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. Voir .env.example pour la liste attendue.`,
    );
  }
  return value;
}

export const env = {
  get mongodbUri() {
    return required("MONGODB_URI");
  },
  get mongodbDbName() {
    return process.env.MONGODB_DB ?? "gw2rp";
  },
  get betterAuthSecret() {
    return required("BETTER_AUTH_SECRET");
  },
  /** Le secret de la tâche planifiée météo. Absent, la route d'avancement
   *  refuse tout appel : elle ne s'ouvre pas parce qu'une variable manque. */
  get cronSecret() {
    return process.env.CRON_SECRET ?? "";
  },
  /** L'application Discord : son identifiant et son secret servent à la fois
   *  à lier un compte Discord depuis le site et à connecter l'activité. Sans
   *  eux, ni l'un ni l'autre ne s'ouvre. */
  get discordClientId() {
    return process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? "";
  },
  get discordClientSecret() {
    return process.env.DISCORD_CLIENT_SECRET ?? "";
  },
  /** Le jeton du bot de l'application : il sert à vérifier qu'un participant
   *  est bien dans l'instance de l'activité qu'il dit rejoindre. */
  get discordBotToken() {
    return process.env.DISCORD_BOT_TOKEN ?? "";
  },
  get siteUrl() {
    // Vercel expose l'URL de la préproduction ; en production on force le domaine canonique.
    const explicit = process.env.NEXT_PUBLIC_SITE_URL;
    if (explicit) return explicit.replace(/\/$/, "");
    const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
    if (vercel) return `https://${vercel}`;
    return "http://localhost:3000";
  },
};

export const SITE_URL = env.siteUrl;
