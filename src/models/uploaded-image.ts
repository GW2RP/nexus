import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/** Une image rangée dans le dossier d'un autre que celui qui l'a téléversée.
 *
 *  Le dossier dit à quel contenu une image appartient — `lieux/<auteur>/…` —,
 *  et c'est ce qui rend le ménage sûr. Mais le quota se compte au compte qui
 *  téléverse : l'image qu'un co-gérant pose sur un lieu est à lui, pas à
 *  l'auteur du lieu. Ce registre ne tient que ces cas-là ; une image rangée
 *  sous celui qui l'a téléversée n'a besoin d'aucune ligne.
 *
 *  La ligne s'écrit à l'émission du jeton, quand le chemin est déjà fixé : elle
 *  ne dépend d'aucun rappel du magasin. Un jeton jamais servi laisse une ligne
 *  sans fichier, que l'inventaire efface en la croisant. */
const uploadedImageSchema = new Schema(
  {
    pathname: { type: String, required: true, unique: true },
    uploaderId: { type: String, required: true, index: true },
    /** Le propriétaire du dossier : l'auteur du contenu. */
    ownerId: { type: String, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

export type UploadedImageDocument = InferSchemaType<typeof uploadedImageSchema>;

export const UploadedImage: Model<UploadedImageDocument> =
  (models.UploadedImage as Model<UploadedImageDocument>) ??
  model<UploadedImageDocument>("UploadedImage", uploadedImageSchema);
