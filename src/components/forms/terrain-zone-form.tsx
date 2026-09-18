"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { PolygonPicker } from "@/components/map/polygon-picker";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Slider } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SectionHeading } from "@/components/ui/section-heading";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  DRAWN_TERRAINS,
  REGIONS,
  REGION_LABELS,
  TERRAIN_LABELS,
  type Terrain,
} from "@/lib/domain";
import { idleState } from "@/lib/action-state";
import { TERRAIN_TONES } from "@/lib/weather/tones";
import {
  createTerrainZoneAction,
  updateTerrainZoneAction,
} from "@/server/actions/terrain-zones";
import type { TerrainZoneOutline } from "@/server/types";

export function TerrainZoneForm({ zone }: { zone?: TerrainZoneOutline }) {
  const [state, formAction] = useActionState(
    zone ? updateTerrainZoneAction : createTerrainZoneAction,
    idleState,
  );
  const errors = state.fieldErrors ?? {};
  const [terrain, setTerrain] = useState<Terrain>(zone?.terrain ?? "mer");

  return (
    <form action={formAction} className="flex max-w-[860px] flex-col gap-8">
      {zone ? <input type="hidden" name="id" value={zone.id} /> : null}

      <section>
        <SectionHeading title="La zone" compact />
        <div className="flex flex-col gap-4">
          <Field label="Nom" htmlFor="name" required error={errors.name}>
            <Input
              id="name"
              name="name"
              required
              maxLength={80}
              defaultValue={zone?.name}
              placeholder="Marais de Kessex"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Terrain" htmlFor="terrain" required error={errors.terrain}>
              <Select
                id="terrain"
                name="terrain"
                required
                value={terrain}
                onChange={(event) => setTerrain(event.target.value as Terrain)}
              >
                {DRAWN_TERRAINS.map((value) => (
                  <option key={value} value={value}>
                    {TERRAIN_LABELS[value]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Région"
              htmlFor="region"
              hint="Une mer n'appartient à aucune région."
              error={errors.region}
            >
              <Select id="region" name="region" defaultValue={zone?.region ?? ""}>
                <option value="">Hors région</option>
                {REGIONS.map((region) => (
                  <option key={region} value={region}>
                    {REGION_LABELS[region]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Altitude"
              htmlFor="altitude"
              hint="De 0 à 100. Ne compte que pour le relief."
              error={errors.altitude}
            >
              <Slider
                id="altitude"
                name="altitude"
                min={0}
                max={100}
                step={5}
                defaultValue={zone?.altitude ?? 0}
              />
            </Field>
          </div>
        </div>
      </section>

      <section>
        <SectionHeading title="Le tracé" compact />
        <PolygonPicker
          tone={TERRAIN_TONES[terrain]}
          initial={zone?.points ?? null}
          error={errors.points}
        />
      </section>

      <FormMessage state={state} />

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton size="lead" pendingLabel="ENREGISTREMENT…">
          {zone ? "ENREGISTRER LA ZONE" : "CRÉER LA ZONE"}
        </SubmitButton>
        <Button asChild variant="link" size="inline">
          <Link href="/admin/terrains">Annuler</Link>
        </Button>
      </div>
    </form>
  );
}
