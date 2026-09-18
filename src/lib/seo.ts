import type { Metadata } from "next";

import { SITE_URL } from "@/lib/env";

export { SITE_URL };

export const SITE_NAME = "GW2RP Nexus";
export const SITE_TAGLINE = "Le hub du jeu de rôle en Tyrie";
export const SITE_DESCRIPTION =
  "Hub communautaire francophone de jeu de rôle dans l'univers de Guild Wars 2 : registre des personnages, carte vivante, agenda des évènements et tableau des rumeurs.";
export const SITE_LOCALE = "fr_FR";

type PageSeo = {
  title: string;
  description: string;
  /** Chemin absolu depuis la racine, « /personnages/aeliane-vhaar ». */
  path: string;
  /** Une image d'illustration propre à la page, si elle en a une. */
  image?: string | null;
  imageAlt?: string | null;
  type?: "website" | "article" | "profile";
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  /** Les pages de création, d'édition et d'administration restent hors des index. */
  noIndex?: boolean;
  keywords?: string[];
};

/** Construit les métadonnées d'une page : titre, description, canonique,
 *  Open Graph et carte Twitter, à partir d'une seule déclaration. */
export function buildMetadata({
  title,
  description,
  path,
  image,
  imageAlt,
  type = "website",
  publishedTime,
  modifiedTime,
  authors,
  noIndex = false,
  keywords,
}: PageSeo): Metadata {
  const url = `${SITE_URL}${path}`;
  const ogImage = image ?? `${SITE_URL}/opengraph-image`;

  return {
    title,
    description,
    keywords,
    alternates: { canonical: url },
    robots: noIndex
      ? { index: false, follow: false, nocache: true }
      : { index: true, follow: true },
    openGraph: {
      type: type === "profile" ? "profile" : type,
      url,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      title,
      description,
      images: [{ url: ogImage, alt: imageAlt ?? title, width: 1200, height: 630 }],
      ...(publishedTime ? { publishedTime } : {}),
      ...(modifiedTime ? { modifiedTime } : {}),
      ...(authors ? { authors } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

/** Un fil d'Ariane lisible par les moteurs, en complément du fil affiché. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

export function jsonLdScript(data: unknown) {
  return {
    __html: JSON.stringify(data).replace(/</g, "\\u003c"),
  };
}
