import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Core Browser Share",
  description: "Compartí tu navegador en tiempo real con un código simple.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-core-bg">
        <header className="border-b border-core-border px-6 py-4">
          <a href="/" className="flex items-center gap-3 w-fit">
            <span className="rounded-md bg-core-accent px-2 py-0.5 font-mono text-xs font-semibold text-white">
              CORE
            </span>
            <span className="text-sm font-medium text-core-text-muted tracking-wide">
              Browser Share
            </span>
          </a>
        </header>
        <main className="mx-auto max-w-2xl px-6 py-12">{children}</main>
      </body>
    </html>
  );
}
