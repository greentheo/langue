import type { MetadataRoute } from "next";

/**
 * The web app manifest: what a phone needs to install Langue on the home
 * screen and open it full-screen, like an app. Served at /manifest.webmanifest.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Langue",
    short_name: "Langue",
    description: "Learn Italian, Spanish, French and Portuguese, three minutes at a time.",
    id: "/",
    start_url: "/learn",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0e0a",
    theme_color: "#0a0e0a",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
