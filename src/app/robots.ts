import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Les pages de compte, de création, d'édition et d'administration
        // n'ont rien à faire dans un index.
        disallow: [
          "/api/",
          "/admin/",
          "/mon-compte",
          "/connexion",
          "/*/modifier",
          "/personnages/nouveau",
          "/lieux/nouveau",
          "/evenements/nouveau",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
