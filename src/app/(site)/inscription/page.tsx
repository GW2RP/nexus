import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignUpForm } from "@/components/forms/sign-up-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { buildMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = buildMetadata({
  title: "Créer un compte",
  description:
    "Rejoindre le hub GW2RP Nexus : tenir ses fiches de personnage, poser des lieux, annoncer des scènes et s'inscrire aux évènements.",
  path: "/inscription",
});

export default async function SignUpPage({
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
        title="Créer un compte"
      />
      <Card accent className="p-7">
        <SignUpForm next={suite?.startsWith("/") ? suite : "/"} />
      </Card>
    </div>
  );
}
