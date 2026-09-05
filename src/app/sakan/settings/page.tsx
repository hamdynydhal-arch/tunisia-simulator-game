"use client";

/**
 * Sakan (سَكَن) — Settings Page (شاشة الإعدادات)
 *
 * SPEC §8.3–§8.5: التمويه والخصوصية وزر المسح والإرشادات الأولى
 *
 * ─── محتوى الشاشة ─────────────────────────────────────────────────────────────
 * ١. تنبيه عند أول تشغيل: إرشاد هادئ بلا تخويف — التطبيق في المتصفح + التثبيت كـ PWA.
 * ٢. مدخل الميثاق: زر يفتح SakanCovenantScreen في أي وقت.
 * ٣. لمسة هدوء (الزوجة وحدها): AmbientSerenityKey في موضع ثابت، بلا شارة ولا تذكير.
 * ٤. الجسر الآمن: يُذكر مرة واحدة بهدوء، بلا إلحاح ولا اعتراض للمسار.
 * ٥. زر المسح الفوري: يمحو كل شيء محلياً بلا تأكيد مطوّل.
 *
 * ─── محظورات صريحة ───────────────────────────────────────────────────────────
 * - AmbientSerenityKey لا تُعرض للزوج بأي حال.
 * - لا شارة، لا تذكير، لا عنصر يلفت إلى لمسة الهدوء.
 * - الجسر الآمن يُذكر مرة واحدة — لا رسالة ثانية، لا modal، لا اعتراض.
 * - زر المسح يعمل مباشرة — لا confirm() مطوّل.
 */

import { useState, useEffect } from "react";
import type { SakanRole } from "@/types/sakan";
import SakanCovenantScreen from "@/components/sakan/SakanCovenantScreen";
import AmbientSerenityKey from "@/components/sakan/AmbientSerenityKey";
import { wipeAllLocalData } from "@/lib/sakan/idb";

// ─── localStorage keys ───────────────────────────────────────────────────────

const BROWSER_WARNING_SEEN_KEY = "s.b.w"; // first-run browser/PWA warning

// ─── First-run browser warning ────────────────────────────────────────────────

/**
 * تنبيه هادئ يُعرض مرة واحدة عند أول زيارة للإعدادات.
 * يُرشد المستخدم لتثبيت التطبيق كـ PWA وتنظيف سجل التصفح إن رغب.
 * صياغة هادئة بلا تخويف — إرشاد لا تحذير.
 */
function FirstRunBrowserGuide({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="rounded-2xl bg-white/70 border border-stone-100 px-5 py-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-xl mt-0.5">🌿</span>
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-semibold text-stone-700">
            التطبيق يعمل في متصفحك
          </p>
          <p className="text-xs text-stone-500 leading-relaxed">
            يمكنك تثبيته على شاشتك الرئيسية من خيار "إضافة إلى الشاشة الرئيسية"
            في قائمة المتصفح. كل بياناتك تبقى على جهازك وحده.
          </p>
          <p className="text-xs text-stone-400 leading-relaxed">
            إن رغبت في إخفاء أثر الزيارة، يمكنك حذف سجل التصفح من إعدادات متصفحك
            لهذا الموقع.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="self-end text-xs text-stone-400 hover:text-stone-600 transition-colors underline underline-offset-2"
      >
        فهمت
      </button>
    </div>
  );
}

// ─── Safe bridge section ──────────────────────────────────────────────────────

/**
 * الجسر الآمن — يُذكر مرة واحدة بهدوء.
 * لا إلحاح، لا modal، لا اعتراض لأي مسار في التطبيق.
 */
function SafeBridgeSection() {
  return (
    <div className="rounded-2xl bg-white/50 border border-stone-100 px-5 py-4">
      <p className="text-xs text-stone-500 leading-relaxed">
        إن كنتَ في موقف يحتاج دعماً متخصصاً، خط مساندة للدعم النفسي
        متاح على{" "}
        <span className="font-medium text-stone-600">920033360</span>
        {" "}(المملكة العربية السعودية).
      </p>
    </div>
  );
}

// ─── Wipe button ──────────────────────────────────────────────────────────────

/**
 * زر المسح الفوري — يمحو كل البيانات المحلية دون تأكيد مطوّل.
 * يطلب تأكيداً خفيفاً واحداً (تبديل الزر) ثم يُنفِّذ مباشرة.
 */
function WipeButton() {
  const [phase, setPhase] = useState<"idle" | "confirm" | "wiping" | "done">("idle");

  async function handleWipe() {
    if (phase === "idle") {
      setPhase("confirm");
      return;
    }
    if (phase === "confirm") {
      setPhase("wiping");
      try {
        await wipeAllLocalData();
        // Also clear localStorage keys this app owns
        try {
          localStorage.removeItem("s.c.v");  // covenant seen
          localStorage.removeItem(BROWSER_WARNING_SEEN_KEY);
        } catch {
          // localStorage may be unavailable — silent
        }
        setPhase("done");
      } catch {
        setPhase("idle");
      }
    }
  }

  if (phase === "done") {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <span aria-hidden className="text-2xl">🌱</span>
        <p className="text-xs text-stone-500">تم مسح جميع البيانات المحلية.</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleWipe}
      disabled={phase === "wiping"}
      className={[
        "w-full rounded-xl py-3 px-5 text-sm font-medium transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2",
        phase === "confirm"
          ? "bg-red-50 border border-red-200 text-red-700 hover:bg-red-100"
          : "bg-stone-50 border border-stone-200 text-stone-500 hover:bg-stone-100",
        phase === "wiping" ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ")}
    >
      {phase === "idle" && "مسح جميع البيانات المحلية"}
      {phase === "confirm" && "اضغط مجدداً للتأكيد والمسح الفوري"}
      {phase === "wiping" && "…جارٍ المسح"}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// الصفحة — SettingsPage
// ═══════════════════════════════════════════════════════════════════════════════

export default function SettingsPage() {
  // الدور مُخزَّن في localStorage أو يُطلب من المستخدم اختياره.
  // في Phase 1: نقرأ الدور مباشرة من localStorage إن وُجد.
  const [role, setRole] = useState<SakanRole | null>(null);
  const [covenantOpen, setCovenantOpen] = useState(false);
  const [browserGuideVisible, setBrowserGuideVisible] = useState(false);

  // ── تحميل الدور وحالة تنبيه المتصفح من localStorage ──────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem("s.r"); // role key (if set by onboarding)
      if (stored === "wife" || stored === "husband") setRole(stored);
      const seen = localStorage.getItem(BROWSER_WARNING_SEEN_KEY);
      if (!seen) setBrowserGuideVisible(true);
    } catch {
      // localStorage unavailable — silent
    }
  }, []);

  function dismissBrowserGuide() {
    setBrowserGuideVisible(false);
    try { localStorage.setItem(BROWSER_WARNING_SEEN_KEY, "1"); } catch { /* silent */ }
  }

  // ── الميثاق المُعاد فتحه يعلو على الصفحة ─────────────────────────────────
  if (covenantOpen && role) {
    return (
      <SakanCovenantScreen
        role={role}
        onDismiss={() => setCovenantOpen(false)}
      />
    );
  }

  return (
    <div
      className="flex flex-col gap-6 w-full max-w-sm mx-auto px-5 py-10"
      dir="rtl"
    >
      {/* ── ١. تنبيه أول تشغيل ────────────────────────────────────────────── */}
      {browserGuideVisible && (
        <FirstRunBrowserGuide onDismiss={dismissBrowserGuide} />
      )}

      {/* ── ٢. مدخل الميثاق ──────────────────────────────────────────────── */}
      <section>
        <p className="text-xs text-stone-400 mb-3 font-medium uppercase tracking-wide">
          الميثاق
        </p>
        <button
          type="button"
          onClick={() => {
            // إن لم يُحدَّد الدور بعد، نفتح الميثاق بدور محايد (husband)
            if (!role) setRole("husband");
            setCovenantOpen(true);
          }}
          className="w-full rounded-xl py-3 px-5 text-sm text-stone-600 bg-white/70 border border-stone-100 hover:bg-white/90 transition-all text-right"
        >
          فتح ميثاق سَكَن
        </button>
      </section>

      {/* ── ٣. لمسة هدوء — الزوجة وحدها ─────────────────────────────────── */}
      {/*
       * SPEC §8.5: لمسة الهدوء تبقى في موضع ثابت داخل إعدادات الزوجة:
       * بلا شارة، بلا تذكير، بلا أي عنصر يلفت إليها.
       * لا تُعرض للزوج بأي حال.
       */}
      {role === "wife" && (
        <section className="flex justify-center py-2">
          <AmbientSerenityKey
            wifeLockPassphrase=""   // passphrase تأتي من getCachedPassphrase() في Phase 4
            className="opacity-70 hover:opacity-100"
          />
        </section>
      )}

      {/* ── ٤. الجسر الآمن — مرة واحدة، بهدوء ──────────────────────────── */}
      <SafeBridgeSection />

      {/* ── ٥. زر المسح الفوري ───────────────────────────────────────────── */}
      <section>
        <p className="text-xs text-stone-400 mb-3 font-medium uppercase tracking-wide">
          البيانات المحلية
        </p>
        <WipeButton />
      </section>
    </div>
  );
}
