import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = "https://before-you-buy-ten.vercel.app/";
const siteName = "Before You Buy";
const siteDescription =
  "Think before you checkout. Upload a product screenshot or paste a link and get an instant AI recommendation to Buy, Wait, or Skip.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: "%s · Before You Buy",
  },
  description: siteDescription,
  keywords: [
    "before you buy",
    "buy or skip",
    "should i buy",
    "purchase decision",
    "impulse buying",
    "shopping assistant",
    "AI shopping assistant",
    "product recommendation",
    "buy wait skip",
    "online shopping",
    "consumer AI",
    "amazon shopping",
    "target shopping",
    "costco shopping",
    "walmart shopping",
    "shopping decisions",
  ],
  authors: [{ name: "Sudeepa Kolli" }],
  creator: "Sudeepa Kolli",
  applicationName: siteName,
  category: "Shopping",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: siteName,
    description:
      "Think before you checkout.\n\nUpload a screenshot or paste a product link and get an instant AI recommendation before spending your money.",
    url: siteUrl,
    siteName,
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Before You Buy, an AI-powered purchase decision assistant.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description:
      "An AI purchase decision assistant that helps you avoid impulse buys.",
    images: ["/twitter-image"],
  },
  appleWebApp: {
    capable: true,
    title: siteName,
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "mask-icon", url: "/safari-pinned-tab.svg", color: "#5e17eb" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#5e17eb",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
