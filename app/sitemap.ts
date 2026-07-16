import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://before-you-buy-ten.vercel.app/",
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
