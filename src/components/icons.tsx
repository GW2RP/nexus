import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

/** Les icônes du système : SVG en trait, sans remplissage, héritant de la couleur
 *  du texte. Le glyphe d'un type est le même partout — puce, ligne de liste, pin
 *  de carte. Jamais d'emoji. */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 16, className, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
      {...props}
    >
      {children}
    </svg>
  );
}

/* --- Glyphes de type — partagés par les puces, les listes et les pins --------- */

export function TavernIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 3 h7 l-1 9 h-5 z M11 5 h3 v4 h-3" />
    </Icon>
  );
}

export function AdventureIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 13 L11 5 M9 3 L13 7 M2.5 12.5 L3.5 13.5" />
    </Icon>
  );
}

export function TradeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="5" />
      <path d="M8 5.2 v5.6 M6.4 6.6 h3.2" />
    </Icon>
  );
}

export function BannerIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 2.5 h7 v7 l-3.5 -2 -3.5 2 z M8 9.5 v4" />
    </Icon>
  );
}

export function ScalesIcon(props: IconProps) {
  return (
    <Icon {...props} strokeWidth={1.2}>
      <path d="M8 2.5 v11 M4 5 h8 M3 5 l-1.5 3.5 h3 z M13 5 l1.5 3.5 h-3 z" />
    </Icon>
  );
}

export function RuinIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 13 h10 M4.5 13 v-6 M7.5 13 v-8 M10.5 13 v-5" />
    </Icon>
  );
}

/* --- Glyphes d'interface ----------------------------------------------------- */

export function PinIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 14 C8 14 13 9.5 13 6.2 A5 5 0 0 0 3 6.2 C3 9.5 8 14 8 14 Z" />
      <circle cx="8" cy="6.2" r="1.7" />
    </Icon>
  );
}

export function FlagIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.2 14 V2.4 M4.2 3 h8.4 l-1.7 2.8 1.7 2.8 H4.2" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="7.2" cy="7.2" r="4.4" />
      <path d="M10.6 10.6 L14 14" />
    </Icon>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13 9.8 A5.6 5.6 0 0 1 6.2 3 A5.6 5.6 0 1 0 13 9.8 Z" />
    </Icon>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="3.2" />
      <path d="M8 1.4 v1.6 M8 13 v1.6 M1.4 8 h1.6 M13 8 h1.6 M3.4 3.4 l1.1 1.1 M11.5 11.5 l1.1 1.1 M12.6 3.4 l-1.1 1.1 M4.5 11.5 l-1.1 1.1" />
    </Icon>
  );
}

export function RainIcon(props: IconProps) {
  return (
    <Icon {...props} strokeWidth={1.2}>
      <path d="M4.5 10 A2.6 2.6 0 0 1 5 5 A3.4 3.4 0 0 1 11.4 5.4 A2.3 2.3 0 0 1 11 10 Z" />
      <path d="M6 12 l-1 2 M9 12 l-1 2" />
    </Icon>
  );
}

export function CloudIcon(props: IconProps) {
  return (
    <Icon {...props} strokeWidth={1.2}>
      <path d="M4.5 11 A2.6 2.6 0 0 1 5 6 A3.4 3.4 0 0 1 11.4 6.4 A2.3 2.3 0 0 1 11 11 Z" />
    </Icon>
  );
}

export function StormIcon(props: IconProps) {
  return (
    <Icon {...props} strokeWidth={1.2}>
      <path d="M4.5 10 A2.6 2.6 0 0 1 5 5 A3.4 3.4 0 0 1 11.4 5.4 A2.3 2.3 0 0 1 11 10 Z" />
      <path d="M8.6 11 L6.6 13.6 h2 l-1 2" />
    </Icon>
  );
}

export function MistIcon(props: IconProps) {
  return (
    <Icon {...props} strokeWidth={1.2}>
      <path d="M2.5 5.5 h11 M3.5 8 h9 M2.5 10.5 h11" />
    </Icon>
  );
}

export function SnowIcon(props: IconProps) {
  return (
    <Icon {...props} strokeWidth={1.2}>
      <path d="M8 2 v12 M2.8 5 l10.4 6 M13.2 5 l-10.4 6" />
    </Icon>
  );
}

/** Le vent : des rafales qui s'enroulent, sans flèche ni emoji. */
export function WindIcon(props: IconProps) {
  return (
    <Icon {...props} strokeWidth={1.2}>
      <path d="M2 5.5 h7.5 a1.8 1.8 0 1 0 -1.8 -1.8" />
      <path d="M2 8.5 h10 a1.8 1.8 0 1 1 -1.8 1.8" />
      <path d="M2 11.5 h5.5" />
    </Icon>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <Icon {...props} strokeWidth={1.2}>
      <path d="M8 2 l1.8 4 4.2 .5 -3.1 2.9 .9 4.1 -3.8 -2.1 -3.8 2.1 .9 -4.1 -3.1 -2.9 4.2 -.5 z" />
    </Icon>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="3.5" width="11" height="10" />
      <path d="M2.5 6.5 h11 M5.5 2 v2.6 M10.5 2 v2.6" />
    </Icon>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="5.6" r="2.8" />
      <path d="M2.8 14 C2.8 10.8 5.1 9.2 8 9.2 C10.9 9.2 13.2 10.8 13.2 14" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 8.4 L6.4 12 L13 4.6" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4 L12 12 M12 4 L4 12" />
    </Icon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 6 L8 10.5 L12.5 6" />
    </Icon>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 4.5 h11 M2.5 8 h11 M2.5 11.5 h11" />
    </Icon>
  );
}

export function LayersIcon(props: IconProps) {
  return (
    <Icon {...props} strokeWidth={1.2}>
      <path d="M8 2 L14 5.5 L8 9 L2 5.5 Z M2 9 L8 12.5 L14 9" />
    </Icon>
  );
}

/** La marque : le losange tyrien barré. */
export function NexusMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
    >
      <path d="M14 2 L19.5 14 L14 26 L8.5 14 Z" />
      <path d="M2 14 H26" />
    </svg>
  );
}
