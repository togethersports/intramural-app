import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Intramural",
    short_name: "Intramural",
    description:
      "Run your school intramural league: drafts, scheduling, live stats, standings, and playoffs.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#8399ac",
    theme_color: "#8399ac",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
