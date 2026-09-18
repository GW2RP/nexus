/**
 * Pose le rôle d'un compte. C'est le seul chemin pour nommer la première
 * administration : le rôle ne se choisit pas à l'inscription.
 *
 *   npm run db:role -- vous@exemple.fr administration
 *   npm run db:role -- conteur@exemple.fr conteur
 *   npm run db:role                        (liste les comptes et leur rôle)
 */

import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

import { ROLES, type Role } from "@/lib/domain";
import { connectToDatabase } from "@/lib/mongoose";
import { User } from "@/models/user";

async function main() {
  const [email, role] = process.argv.slice(2);
  await connectToDatabase();

  if (!email) {
    const users = await User.find().select({ email: 1, name: 1, role: 1 }).sort({ email: 1 }).lean();
    if (users.length === 0) {
      console.log("Aucun compte en base.");
    } else {
      for (const user of users) {
        console.log(`${(user.role ?? "membre").padEnd(15)} ${user.email}  (${user.name})`);
      }
    }
    console.log(`\nRôles possibles : ${ROLES.join(", ")}`);
    return;
  }

  if (!role || !ROLES.includes(role as Role)) {
    throw new Error(`Rôle attendu parmi : ${ROLES.join(", ")}`);
  }

  const updated = await User.findOneAndUpdate(
    { email },
    { role },
    { returnDocument: "after" },
  ).lean();

  if (!updated) throw new Error(`Aucun compte avec l'adresse ${email}.`);
  console.log(`${updated.email} est désormais : ${role}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
