import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    lang: "en",
    dir: "ltr",
    name: "Lanka Post Directory",
    short_name: "Lanka Post",
    description:
      "Find every Sri Lanka post office — postal codes, opening hours, phone numbers and postage rates.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    prefer_related_applications: false,
    background_color: "#FBF7EF",
    theme_color: "#FBF7EF",
    categories: ["utilities", "navigation", "reference"],
    shortcuts: [
      {
        name: "Search offices",
        short_name: "Search",
        url: "/",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Postage rates",
        short_name: "Rates",
        url: "/calculator",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Browse A–Z",
        short_name: "Browse",
        url: "/browse",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Rate Tables",
        short_name: "Tables",
        url: "/rates",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
