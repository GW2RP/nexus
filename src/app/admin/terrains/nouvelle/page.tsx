import type { Metadata } from "next";

import { TerrainZoneForm } from "@/components/forms/terrain-zone-form";
import { PageHeader } from "@/components/ui/page-header";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Nouvelle zone de terrain",
  description: "Dessiner une zone de terrain sur la carte.",
  path: "/admin/terrains/nouvelle",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default function NewTerrainZonePage() {
  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="Nouvelle zone" />
      <TerrainZoneForm />
    </div>
  );
}
