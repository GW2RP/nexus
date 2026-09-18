import { MongoClient, type Db } from "mongodb";

import { env } from "@/lib/env";

/** Client MongoDB natif — utilisé par l'adaptateur Better Auth.
 *  `MongoClient` se connecte paresseusement : `client.db()` est disponible
 *  immédiatement, la connexion s'ouvre à la première requête.
 *  En développement le client est mis en cache sur `globalThis` pour survivre au
 *  rechargement à chaud ; sur Vercel chaque instance de fonction garde le sien. */

declare global {
  var __mongoClient: MongoClient | undefined;
}

function createClient(): MongoClient {
  return new MongoClient(env.mongodbUri, { maxPoolSize: 10, retryWrites: true });
}

export const mongoClient: MongoClient = globalThis.__mongoClient ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__mongoClient = mongoClient;
}

export const mongoDb: Db = mongoClient.db(env.mongodbDbName);
