import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DeleteContent } from "@/components/content/delete-content";
import { TerrainZoneForm } from "@/components/forms/terrain-zone-form";
import { PageHeader } from "@/components/ui/page-header";
import { TERRAIN_LABELS } from "@/lib/domain";
import { buildMetadata } from "@/lib/seo";
import { deleteTerrainZoneAction } from "@/server/actions/terrain-zones";
import { getTerrainZone } from "@/server/queries/weather";

export const metadata: Metadata = buildMetadata({
  title: "Modifier une zone de terrain",
  description: "Modifier le tracé et le terrain d'une zone.",
  path: "/admin/terrains",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function EditTerrainZonePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const zone = await getTerrainZone(id);
  if (!zone) notFound();

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title={zone.name}
        action={
          <DeleteContent
            id={zone.id}
            action={deleteTerrainZoneAction}
            title={zone.name}
            question="Retirer cette zone ?"
            consequence="La simulation reprendra sans elle au prochain pas : le terrain qu'elle portait redevient de la plaine."
            excerpt={`${TERRAIN_LABELS[zone.terrain]}, ${zone.points.length} sommets`}
            verb="RETIRER LA ZONE"
          />
        }
      />
      <TerrainZoneForm zone={zone} />
    </div>
  );
}
