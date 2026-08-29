import type { MetadataRoute } from "next";
import { brand } from "@paycheck/config";

/**
 * PWA-Manifest. Der Name kommt aus der zentralen Konfiguration, damit
 * eine Umbenennung auch auf dem Homescreen ankommt.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.name,
    short_name: brand.shortName,
    description: brand.tagline.de,
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf8f5",
    theme_color: "#faf8f5",
    lang: "de",
    categories: ["productivity", "business"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
