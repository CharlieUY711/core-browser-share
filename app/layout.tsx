import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#6366f1",
};

export const metadata: Metadata = {
  title: "Core Browser Share",
  description: "Compartí tu navegador en tiempo real con un código simple.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CoreShare",
  },
  icons: {
    icon: "/favicon.svg",
    apple: "/icon-192.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="min-h-screen min-h-dvh bg-core-bg">
        <header className="border-b border-core-border px-6 py-4 safe-top">
          <a href="/" className="flex items-center gap-3 w-fit">
            <span className="rounded-md bg-core-accent px-2 py-0.5 font-mono text-xs font-semibold text-white">
              CORE
            </span>
            <span className="text-sm font-medium text-core-text-muted tracking-wide">
              Browser Share
            </span>
          </a>
        </header>
        <main className="mx-auto max-w-2xl px-6 py-12 safe-bottom">{children}</main>
      </body>
    </html>
  );
}
