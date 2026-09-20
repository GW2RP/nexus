import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { InvitationCodeForm } from "@/components/content/invitation-code-form";
import { PageHeader } from "@/components/ui/page-header";
import { buildMetadata } from "@/lib/seo";
import { normaliserCodeDePartage } from "@/lib/share-code";

export const metadata: Metadata = buildMetadata({
  title: "Ouvrir une invitation",
  description: "Ouvrir une scène privée à partir de son code d'invitation.",
  path: "/invitation",
  noIndex: true,
});

/** Le guichet des codes : `/invitation?code=…` renvoie sur l'adresse du lien.
 *  Un code se reçoit aussi de vive voix, en jeu — il doit donc se taper. */
export default async function InvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const normalise = code ? normaliserCodeDePartage(code) : null;
  if (normalise) redirect(`/invitation/${normalise}`);

  return (
    <div className="mx-auto max-w-[760px] px-gutter-mobile py-10 lg:px-gutter-desktop">
      <PageHeader
        eyebrow="INVITATION"
        title={code ? "Ce code n'existe pas" : "Ouvrir une invitation"}
        subtitle={
          code
            ? "Un code compte huit caractères, sans O ni I ni zéro — ils se confondent trop à l'oral."
            : undefined
        }
      />
      <InvitationCodeForm label="Code d'invitation" />
      <p className="mt-8">
        <Link
          href="/evenements"
          className="text-[17px] text-crimson-ink underline-offset-4 hover:underline"
        >
          Voir l&apos;agenda public →
        </Link>
      </p>
    </div>
  );
}
