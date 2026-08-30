/**
 * Sakan (سَكَن) — Route layout
 *
 * Overrides the main game's dark `body` gradient with a calm, warm light
 * palette appropriate for a trauma-informed therapeutic companion.
 * All child components inherit the warm stone background and the Cairo font
 * (already loaded in the root layout).
 */

export const metadata = {
  title: "سَكَن — مساحتك الآمنة",
  description:
    "تطبيق سَكَن: مساحة خاصة وآمنة لإعادة بناء الألفة والاطمئنان داخل العلاقة الزوجية.",
  robots: "noindex, nofollow",   // therapeutic app — keep out of search indexes
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
