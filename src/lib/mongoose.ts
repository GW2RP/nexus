import mongoose from "mongoose";

import { env } from "@/lib/env";

/** Connexion Mongoose partagée — les modèles métier passent par elle.
 *  Better Auth utilise le driver natif sur la même base (voir lib/mongo.ts). */

declare global {
  var __mongooseConnection: Promise<typeof mongoose> | undefined;
}

export function connectToDatabase(): Promise<typeof mongoose> {
  if (!globalThis.__mongooseConnection) {
    mongoose.set("strictQuery", true);
    globalThis.__mongooseConnection = mongoose.connect(env.mongodbUri, {
      dbName: env.mongodbDbName,
      bufferCommands: false,
      maxPoolSize: 10,
    });
  }
  return globalThis.__mongooseConnection;
}
