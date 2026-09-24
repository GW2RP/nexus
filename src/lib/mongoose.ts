import mongoose from "mongoose";

import { env } from "@/lib/env";

/** Connexion Mongoose partagée — les modèles métier passent par elle.
 *  Better Auth utilise le driver natif sur la même base (voir lib/mongo.ts). */

declare global {
  var __mongooseConnection: Promise<typeof mongoose> | undefined;
}

/**
 * La promesse de connexion est gardée pour que toutes les requêtes d'une
 * instance partagent la même — mais **pas quand elle échoue**. Gardée rejetée,
 * elle faisait échouer toutes les lectures et écritures suivantes jusqu'au
 * prochain démarrage à froid, alors même que la base était revenue.
 *
 * Même chose quand la topologie du client se ferme sans qu'on l'ait demandé :
 * le driver la garderait fermée (voir `lib/mongo-connection.ts`), donc la
 * connexion suivante repart d'un client neuf.
 */
export function connectToDatabase(): Promise<typeof mongoose> {
  if (!globalThis.__mongooseConnection) {
    // Seule la promesse du moment s'oublie : un ancien client qui se ferme ne
    // doit pas faire rouvrir la connexion qui l'a remplacé.
    const forget = () => {
      if (globalThis.__mongooseConnection === pending) {
        globalThis.__mongooseConnection = undefined;
      }
    };
    const pending = open(forget).catch(async (error: unknown) => {
      forget();
      // Rend ce que la tentative ratée a pu ouvrir ; son échec n'apprend rien.
      await mongoose.disconnect().catch(() => {});
      throw error;
    });
    globalThis.__mongooseConnection = pending;
  }
  return globalThis.__mongooseConnection;
}

async function open(onClosed: () => void): Promise<typeof mongoose> {
  // Une connexion dont la topologie s'est fermée se croit parfois encore
  // ouverte, et `connect` la rendrait telle quelle : on la ferme d'abord pour
  // repartir d'un client neuf.
  if (mongoose.connection.readyState !== mongoose.ConnectionStates.disconnected) {
    await mongoose.disconnect().catch(() => {});
  }

  mongoose.set("strictQuery", true);
  const connected = await mongoose.connect(env.mongodbUri, {
    dbName: env.mongodbDbName,
    bufferCommands: false,
    maxPoolSize: 10,
    retryWrites: true,
    retryReads: true,
    // Échouer vite plutôt qu'attendre les 30 s par défaut : une panne se lit
    // comme une erreur de la requête, pas comme une page figée.
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
  });

  const client = connected.connection.getClient();
  // Sans écouteur, un `error` des moniteurs de topologie ferait tomber
  // l'instance entière.
  client.on("error", (error) => {
    console.error("Client MongoDB (Mongoose) en erreur :", error);
  });
  // La connexion suivante repartira d'un client neuf.
  client.once("topologyClosed", onClosed);

  return connected;
}
