import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hembrain",
    short_name: "Hembrain",
    description: "Shared calendar, lists, recipes and family memory.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f6f3",
    theme_color: "#1d1c1a",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
