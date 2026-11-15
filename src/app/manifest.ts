import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lanka Post Directory",
    short_name: "Lanka Post",
    description: "Find every Sri Lanka post office — postal codes, opening hours, phone numbers and postage rates.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FBF7EF",
    theme_color: "#FBF7EF",
    categories: ["utilities", "navigation", "reference"],
    shortcuts: [
      { name: "Search offices", short_name: "Search", url: "/", icons: [{ src: "/icon-192x192.png", sizes: "192x192" }] },
      { name: "Browse A–Z", short_name: "Browse", url: "/browse", icons: [{ src: "/icon-192x192.png", sizes: "192x192" }] },
      { name: "Postage rates", short_name: "Rates", url: "/calculator", icons: [{ src: "/icon-192x192.png", sizes: "192x192" }] },
    ],
    icons: [
      { src: "/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
