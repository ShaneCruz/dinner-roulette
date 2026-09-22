import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dinner Roulette",
    short_name: "Dinner",
    description: "Family dinners, decided.",
    start_url: "/",
    display: "standalone",
    background_color: "#fff8ef",
    theme_color: "#e0492f",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
    shortcuts: [
      { name: "Grocery list", url: "/grocery" },
      { name: "This week", url: "/plan" },
    ],
  };
}
