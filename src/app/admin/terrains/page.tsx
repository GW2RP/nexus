import type { Metadata } from "next";
import Link from "next/link";

import { DeleteContent } from "@/components/content/delete-content";
import { TerrainZoneOrder } from "@/components/forms/terrain-zone-order";
import { TerrainGridPreview } from "@/components/map/terrain-grid-preview";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeading } from "@/components/ui/section-heading";
import { REGION_LABELS, TERRAIN_LABELS } from "@/lib/domain";
import { buildMetadata } from "@/lib/seo";
import { deleteTerrainZoneAction } from "@/server/actions/terrain-zones";
import { getBakedTerrainGrid, listTerrainZones } from "@/server/queries/weather";

export const metadata: Metadata = buildMetadata({
  title: "Terrains",
  description: "Les zones de terrain qui gouvernent la simulation météo.",
  path: "/admin/terrains",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function TerrainsPage() {
  const [zones, grille] = await Promise.all([listTerrainZones(), getBakedTerrainGrid()]);

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Terrains"
        action={
          <Button asChild size="lead">
            <Link href="/admin/terrains/nouvelle">NOUVELLE ZONE</Link>
          </Button>
        }
      />

      <section className="mb-10" aria-labelledby="grille">
        <SectionHeading id="grille" title="La grille telle que la simulation la lit" />
        <TerrainGridPreview zones={zones} grille={grille} />
      </section>

      <section aria-labelledby="zones">
        <SectionHeading id="zones" title="Les zones, dans l'ordre d'application" />
        {zones.length > 0 ? (
          <ol className="flex flex-col">
            {zones.map((zone, index) => (
              <li
                key={zone.id}
                className="flex flex-wrap items-start justify-between gap-4 border-b border-hairline py-5 last:border-b-0"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-gold font-display text-[13px] font-bold text-gold-ink">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-[18px] font-semibold tracking-[1px]">
                      {zone.name}
                    </p>
                    <p className="mt-1 text-[16px] text-ink-muted">
                      {TERRAIN_LABELS[zone.terrain]} ·{" "}
                      {zone.region ? REGION_LABELS[zone.region] : "Hors région"} · altitude{" "}
                      {zone.altitude} · {zone.points.length} sommets
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <Button asChild variant="quiet" size="sm">
                    <Link href={`/admin/terrains/${zone.id}`}>MODIFIER</Link>
                  </Button>
                  <TerrainZoneOrder
                    id={zone.id}
                    name={zone.name}
                    position={index + 1}
                    total={zones.length}
                  />
                  {/* Retirer une zone se fait d'ici comme la réordonner : c'est
                      cette liste qu'on tient, et ouvrir la zone pour la jeter
                      était un détour. */}
                  <DeleteContent
                    id={zone.id}
                    action={deleteTerrainZoneAction}
                    title={zone.name}
                    question="Retirer cette zone ?"
                    consequence="La simulation reprendra sans elle au prochain pas : le terrain qu'elle portait redevient de la plaine."
                    excerpt={`${TERRAIN_LABELS[zone.terrain]}, ${zone.points.length} sommets`}
                    verb="RETIRER LA ZONE"
                  />
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title="Aucune zone dessinée" />
        )}
      </section>
    </div>
  );
}
