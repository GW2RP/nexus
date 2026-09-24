import { MongoClient, type Db } from "mongodb";

import { env } from "@/lib/env";
import { createResilientClient } from "@/lib/mongo-connection";

/** Client MongoDB natif — utilisé par l'adaptateur Better Auth.
 *  `MongoClient` se connecte paresseusement : `client.db()` est disponible
 *  immédiatement, la connexion s'ouvre à la première requête — et si elle
 *  échoue, le client est remplacé au prochain accès (voir
 *  `lib/mongo-connection.ts`).
 *  En développement le client est mis en cache sur `globalThis` pour survivre au
 *  rechargement à chaud ; sur Vercel chaque instance de fonction garde le sien. */

declare global {
  var __mongo: { client: MongoClient; db: Db } | undefined;
}

// Les moniteurs de topologie émettent `error` quand une connexion tombe ; sans
// écouteur, Node lève l'événement et fait tomber toute l'instance — toutes les
// requêtes en cours avec elle, et pas seulement celle qui touchait la base.
// L'écouteur est posé par client créé, pas par évaluation du module : un
// rechargement à chaud n'en empile pas sur le client gardé.
function createClient(): MongoClient {
  const client = new MongoClient(env.mongodbUri, {
    maxPoolSize: 10,
    retryWrites: true,
    retryReads: true,
    // Échouer vite plutôt qu'attendre les 30 s par défaut quand la base est
    // injoignable : une panne se lit comme une erreur de la requête, pas comme
    // une file de requêtes figées.
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
  });
  client.on("error", (error) => {
    console.error("Client MongoDB en erreur :", error);
  });
  return client;
}

const mongo = globalThis.__mongo ?? createResilientClient(createClient, env.mongodbDbName);

if (process.env.NODE_ENV !== "production") {
  globalThis.__mongo = mongo;
}

export const mongoClient: MongoClient = mongo.client;
export const mongoDb: Db = mongo.db;
