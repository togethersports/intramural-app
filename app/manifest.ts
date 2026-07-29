import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Intramural",
    short_name: "Intramural",
    description:
      "Run your school intramural league: drafts, scheduling, live stats, standings, and playoffs.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#8FA6BF",
    theme_color: "#8FA6BF",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/apple-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
