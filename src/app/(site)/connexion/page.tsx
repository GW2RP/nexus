import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/forms/sign-in-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { buildMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = buildMetadata({
  title: "Se connecter",
  description: "Ouvrir une session sur le hub GW2RP Nexus.",
  path: "/connexion",
  noIndex: true,
});

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string }>;
}) {
  const [{ suite }, user] = await Promise.all([searchParams, getCurrentUser()]);
  if (user) redirect(suite ?? "/");

  return (
    <div className="mx-auto max-w-[560px] px-gutter-mobile py-12 lg:px-gutter-desktop">
      <PageHeader
        eyebrow="GW2RP NEXUS"
        title="Se connecter"
        subtitle="Un compte sert à tenir vos fiches, à vous inscrire aux scènes et à signaler un contenu. Lire le hub n'en demande pas."
      />
      <Card accent className="p-7">
        {/* `suite` vient de l'URL : on n'accepte qu'un chemin interne. */}
        <SignInForm next={suite?.startsWith("/") ? suite : "/"} />
      </Card>
    </div>
  );
}
