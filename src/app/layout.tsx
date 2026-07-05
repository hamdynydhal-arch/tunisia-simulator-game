import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import StoreHydrator from "@/components/StoreHydrator";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
});

export const metadata: Metadata = {
  title: "محاكي تونس",
  description: "لعبة استراتيجية شاملة تدور أحداثها في ولايات تونس الأربع والعشرين.",
  applicationName: "محاكي تونس",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <StoreHydrator />
        {children}
      </body>
    </html>
  );
}
