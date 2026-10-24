"use client";

import Link from "next/link";

import { useXrSupport } from "@/components/board/use-xr-support";
import { Button } from "@/components/ui/button";

/** Le chemin vers l'exploration en VR. Il n'apparaît qu'avec un casque : sans
 *  lui, la page ne montrerait qu'une maquette de ce qu'on ne peut pas ouvrir. */
export function BoardVrLink({ href }: { href: string }) {
  const { vr } = useXrSupport();
  if (!vr) return null;
  return (
    <Button asChild variant="outline" size="sm">
      <Link href={href}>{"Explorer en VR".toLocaleUpperCase("fr-FR")}</Link>
    </Button>
  );
}
