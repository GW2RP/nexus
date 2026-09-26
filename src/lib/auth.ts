import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { bearer } from "better-auth/plugins";

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
  // L'application bureau (l'overlay de jeu) tourne dans une vue web Tauri, dont
  // l'origine n'est pas celle du hub. Ses appels passent par le client HTTP de
  // Tauri — sans cookie ni `Origin` —, mais on nomme ses origines pour qu'une
  // requête partie de la vue web elle-même ne soit pas prise pour une attaque.
  trustedOrigins: ["tauri://localhost", "http://tauri.localhost"],
  // Le greffon `bearer` sert l'application bureau : une vue web sans le cookie
  // du hub. À la connexion, il renvoie le jeton de session dans l'en-tête
  // `set-auth-token` ; l'application le range et le représente en
  // `Authorization: Bearer`, que le greffon retraduit en cookie de session.
  // Le navigateur, lui, ne voit rien changer : sans cet en-tête, rien ne bouge.
  //
  // `nextCookies` doit rester le dernier plugin : il pose les cookies de session
  // renvoyés par les actions serveur.
  plugins: [bearer(), nextCookies()],
});
