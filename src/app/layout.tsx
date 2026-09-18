import type { Metadata, Viewport } from "next";
import { Cinzel, EB_Garamond } from "next/font/google";

import { ThemeScript } from "@/components/layout/theme-script";
import { SITE_URL } from "@/lib/env";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, jsonLdScript } from "@/lib/seo";

import "./globals.css";

// Cinzel pour les titres et les capitales, EB Garamond pour ce qui se lit en phrases.
// Georgia en repli : les métriques sont proches, la page ne saute pas.
const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-cinzel",
  display: "swap",
  fallback: ["Georgia", "serif"],
});

const garamond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-garamond",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  generator: "Next.js",
  keywords: [
    "Guild Wars 2",
    "GW2",
    "jeu de rôle",
    "roleplay",
    "RP francophone",
    "Tyrie",
    "communauté",
    "évènements",
    "registre de personnages",
  ],
  authors: [{ name: "La communauté GW2RP" }],
  creator: "GW2RP Nexus",
  publisher: "GW2RP Nexus",
  alternates: {
    canonical: "/",
    languages: { "fr-FR": "/" },
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  category: "Jeux vidéo",
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2e8d5" },
    { media: "(prefers-color-scheme: dark)", color: "#17120e" },
  ],
};

const organisationJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  alternateName: SITE_TAGLINE,
  url: SITE_URL,
  inLanguage: "fr-FR",
  description: SITE_DESCRIPTION,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/personnages?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Les variables de police se posent sur <html> : les jetons de tokens.css
    // vivent sur :root et doivent pouvoir les lire.
    <html
      lang="fr"
      data-theme="light"
      className={`${cinzel.variable} ${garamond.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(organisationJsonLd)} />
      </head>
      <body className="min-h-dvh">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:border focus:border-gold focus:bg-surface focus:px-4 focus:py-3"
        >
          Aller au contenu
        </a>
        {children}
      </body>
    </html>
  );
}
