import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

import { ROLES } from "@/lib/domain";

/** Vue Mongoose de la collection tenue par Better Auth.
 *  Elle sert à lire (nom d'auteur, rôle) et à poser le rôle depuis l'administration ;
 *  la création et l'authentification restent du ressort de Better Auth. */
const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    emailVerified: { type: Boolean, default: false },
    image: { type: String },
    role: { type: String, enum: ROLES, default: "membre", index: true },
    suspendedUntil: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "user", strict: false, versionKey: false },
);

export type UserDocument = InferSchemaType<typeof userSchema>;

export const User: Model<UserDocument> =
  (models.User as Model<UserDocument>) ?? model<UserDocument>("User", userSchema);
