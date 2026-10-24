"use client";

import { useEffect, useState } from "react";

export type XrSupport = { vr: boolean; ar: boolean };

/** Ce que le navigateur sait ouvrir en immersion : un casque branché répond
 *  `immersive-vr`, un casque qui filme la pièce aussi `immersive-ar`. La
 *  question se repose quand un casque arrive ou s'en va (`devicechange`). */
export function useXrSupport(): XrSupport {
  const [support, setSupport] = useState<XrSupport>({ vr: false, ar: false });

  useEffect(() => {
    const xr = typeof navigator === "undefined" ? undefined : navigator.xr;
    if (!xr) return;
    let live = true;
    const ask = (mode: XRSessionMode) => xr.isSessionSupported(mode).catch(() => false);
    const check = () => {
      void Promise.all([ask("immersive-vr"), ask("immersive-ar")]).then(([vr, ar]) => {
        if (live) setSupport({ vr, ar });
      });
    };
    check();
    xr.addEventListener("devicechange", check);
    return () => {
      live = false;
      xr.removeEventListener("devicechange", check);
    };
  }, []);

  return support;
}
