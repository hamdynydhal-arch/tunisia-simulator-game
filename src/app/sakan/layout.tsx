/**
 * Sakan (سَكَن) — Route layout
 *
 * Overrides the main game's dark `body` gradient with a calm, warm light
 * palette appropriate for a trauma-informed therapeutic companion.
 * All child components inherit the warm stone background and the Cairo font
 * (already loaded in the root layout).
 *
 * SPEC §8.1: العنوان يستخدم SAKAN_CAMOUFLAGE_NAME — لا "سَكَن" ولا وصف علاجي.
 */

import { SAKAN_CAMOUFLAGE_NAME } from "@/lib/sakan/camouflage";

export const metadata = {
  title: SAKAN_CAMOUFLAGE_NAME,
  description: "استعرض خياراتك وتفضيلاتك اليومية.",
  robots: "noindex, nofollow",   // keep out of search indexes
};

export default function SakanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    /*
     * The outer wrapper overrides the dark body gradient injected by globals.css.
     * `min-h-dvh` covers the full dynamic viewport height (mobile-safe).
     * `dir="rtl"` is already set on <html> in the root layout; no need to repeat.
     */
    <div
      className="min-h-dvh"
      style={{
        background: "linear-gradient(160deg, #fafaf9 0%, #f5f0e8 50%, #ede8df 100%)",
        color: "#1c2320",
      }}
    >
      {children}
    </div>
  );
}
