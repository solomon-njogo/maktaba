import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Maktaba",
    short_name: "Maktaba",
    description: "A minimal tracker for a personal physical library.",
    start_url: "/",
    display: "standalone",
    background_color: "#0A0A0C",
    theme_color: "#0A0A0C",
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
    ],
  }
}
