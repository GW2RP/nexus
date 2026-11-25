import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mongoose et le driver MongoDB restent côté serveur : ils ne passent pas
  // par le bundler des composants serveur.
  serverExternalPackages: ["mongoose", "mongodb"],
  experimental: {
    serverActions: {
      // L'activité Discord sert le hub depuis `<application>.discordsays.com`,
      // derrière le proxy de Discord : les gestes du panneau y partent par les
      // mêmes actions serveur que sur le site.
      allowedOrigins: ["*.discordsays.com"],
    },
  },
  images: {
    // Les bannières et portraits sont des adresses saisies par les auteurs.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async redirects() {
    return [
      // Le domaine canonique est www.gw2rp.eu ; ces chemins sont d'anciennes
      // habitudes de nommage que l'on garde vivantes.
      { source: "/evenement/:slug", destination: "/evenements/:slug", permanent: true },
      { source: "/personnage/:slug", destination: "/personnages/:slug", permanent: true },
      { source: "/lieu/:slug", destination: "/lieux/:slug", permanent: true },
      { source: "/map", destination: "/carte", permanent: true },
    ];
  },
};

export default nextConfig;
