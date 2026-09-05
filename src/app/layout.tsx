import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import StoreHydrator from "@/components/StoreHydrator";
import { CSP_FONT_SRC } from "@/lib/sakan/camouflage";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
});

export const metadata: Metadata = {
  title: "محاكي تونس",
  description: "لعبة استراتيجية شاملة تدور أحداثها في ولايات تونس الأربع والعشرين.",
  applicationName: "محاكي تونس",
  icons: {
    icon: "/logo.svg?v=sovereign_1",
    apple: "/logo.svg?v=sovereign_1",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "محاكي تونس",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#020617",
};

/**
 * Content-Security-Policy. Enforced as a meta tag because the app is a static
 * export (no server to set headers); Vercel additionally applies it — with
 * frame-ancestors — at the edge via vercel.json. Only our own scripts and the
 * Esri World Imagery tiles Leaflet loads may execute or connect. `unsafe-inline`
 * is required for the static export's inline hydration script and Leaflet's
 * injected styles (a static build has no nonce mechanism).
 *
 * Phase 2 addition: *.supabase.co (HTTPS) and wss://*.supabase.co (Supabase
 * Realtime WebSocket) are added to connect-src so the Sakan Supabase client
 * can reach the project API.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://server.arcgisonline.com https://*.arcgisonline.com",
  "connect-src 'self' https://server.arcgisonline.com https://*.arcgisonline.com https://*.supabase.co wss://*.supabase.co",
  `font-src ${CSP_FONT_SRC}`,
  "frame-ancestors 'none'",
].join("; ");

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full antialiased`}>
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content={CONTENT_SECURITY_POLICY}
        />
      </head>
      <body className="min-h-full flex flex-col bg-gradient-to-br from-slate-950 via-gray-900 to-slate-900">
        <StoreHydrator />
        {children}
      </body>
    </html>
  );
}
