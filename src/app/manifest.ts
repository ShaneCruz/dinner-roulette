import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dinner Roulette",
    short_name: "Dinner",
    description: "Family dinners, decided.",
    start_url: "/",
    display: "standalone",
    background_color: "#fff8ef",
    theme_color: "#f0ad2b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Grocery list", url: "/grocery" },
      { name: "This week", url: "/plan" },
    ],
  };
}
