import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Before You Buy",
    short_name: "BeforeYouBuy",
    description:
      "Before You Buy is an AI-powered purchase decision assistant. Upload a product screenshot or paste a product link, answer three quick questions, and get a simple recommendation: Buy, Wait, or Skip.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f6fa",
    theme_color: "#5e17eb",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
