import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";

import { env } from "@/lib/env";
import { mongoClient, mongoDb } from "@/lib/mongo";

export const auth = betterAuth({
  appName: "GW2RP Nexus",
  baseURL: env.siteUrl,
  secret: env.betterAuthSecret,
  // Atlas est un jeu de réplicas : les transactions de l'adaptateur sont disponibles.
  database: mongodbAdapter(mongoDb, { client: mongoClient }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    // Pas de service d'envoi branché pour l'instant : on n'exige pas la vérification,
    // sans quoi aucun compte ne pourrait ouvrir de session.
    requireEmailVerification: false,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "membre",
        // Le rôle ne se choisit pas à l'inscription : il est posé par l'administration.
        input: false,
      },
      suspendedUntil: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  advanced: {
    cookiePrefix: "gw2rp",
  },
  // `nextCookies` doit rester le dernier plugin : il pose les cookies de session
  // renvoyés par les actions serveur.
  plugins: [nextCookies()],
});
