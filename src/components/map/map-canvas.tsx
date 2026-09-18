"use client";

import dynamic from "next/dynamic";

// Leaflet touche à `window` : la carte est montée côté client uniquement.
export const MapCanvas = dynamic(() => import("@/components/map/tyria-map"), {
  ssr: false,
  loading: () => (
    <div className="hatch size-full" role="status" aria-label="Chargement de la carte" />
  ),
});

export default MapCanvas;
