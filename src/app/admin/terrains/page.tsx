import type { Metadata } from "next";
import Link from "next/link";

import { TerrainGridPreview } from "@/components/map/terrain-grid-preview";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeading } from "@/components/ui/section-heading";
import { REGION_LABELS, TERRAIN_LABELS } from "@/lib/domain";
import { buildMetadata } from "@/lib/seo";
import { getBakedTerrainCells, listTerrainZones } from "@/server/queries/weather";

export const metadata: Metadata = buildMetadata({
  title: "Terrains",
  description: "Les zones de terrain qui gouvernent la simulation météo.",
  path: "/admin/terrains",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function TerrainsPage() {
  const [zones, cells] = await Promise.all([listTerrainZones(), getBakedTerrainCells()]);

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
        <TerrainGridPreview zones={zones} cells={cells} />
      </section>

      <section aria-labelledby="zones">
        <SectionHeading id="zones" title="Les zones" />
        {zones.length > 0 ? (
          <ul className="flex flex-col">
            {zones.map((zone) => (
              <li
                key={zone.id}
                className="flex flex-wrap items-baseline justify-between gap-4 border-b border-hairline py-5 last:border-b-0"
              >
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
                <Button asChild variant="quiet" size="sm">
                  <Link href={`/admin/terrains/${zone.id}`}>MODIFIER</Link>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Aucune zone dessinée" />
        )}
      </section>
    </div>
  );
}
