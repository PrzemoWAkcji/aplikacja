import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "AthleticsPRO — Obsługa Zawodów LA",
  description: "System obsługi zawodów lekkoatletycznych",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AthleticsPRO",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/icon.svg",     sizes: "any",     type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#1a56db",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <head>
        {/* PWA — iOS Safari wymaga osobnych meta tagów */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="AthleticsPRO" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        {/* Windows tile */}
        <meta name="msapplication-TileImage" content="/icons/icon-192.png" />
        <meta name="msapplication-TileColor" content="#1a56db" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
