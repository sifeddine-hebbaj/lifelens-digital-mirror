import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "LifeLens",
    short_name: "LifeLens",
    description: "A private, thoughtful view of your everyday patterns.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#faf8f5",
    theme_color: "#dce9d9",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    screenshots: [
      { src: "/screenshots/ai-wide.png", sizes: "820x461", type: "image/png", form_factor: "wide", label: "Ask LifeLens about your patterns" },
      { src: "/screenshots/ai-narrow.png", sizes: "390x844", type: "image/png", form_factor: "narrow", label: "Ask LifeLens about your patterns" },
    ],
  };
}
