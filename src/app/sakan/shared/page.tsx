"use client";

/**
 * Sakan (سَكَن) — Shared Space Page (صفحة المساحة المشتركة)
 *
 * الخطوة ٧ — إعادة تأهيل المساحة المشتركة
 *
 * يُربط هنا ثلاثة مكوّنات كانت معلّقة:
 * ١. البصمة المشتركة (التقاطع الأعمى)  — ما يتقاطع فقط، والباقي يختفي بلا أثر.
 * ٢. مؤقت الوجود الصامت               — كل جهاز يعمل باستقلالية، لا وضع "ناوِل الهاتف".
 * ٣. قوالب الصياغة المستقبلية          — تمنع الاتهام لا الموضوع.
 *
 * ─── القواعد المعمارية (محظورات صريحة) ────────────────────────────────────────
 * - PartnerContext مُستقبَل في SharedSpaceContent ولا يُمرَّر لأي مكوّن عرض.
 *   AT12 يضمن أن أي وصول مشروط به ينتج HTML مختلفاً → يفشل الاختبار.
 * - لا مؤشر يكشف نشاط الطرف الآخر أو توقفه:
 *   لا "أكمل شريكك"، لا حالة اتصال، لا طابع زمني مرئي، لا عدّاد.
 * - لا شيء يُشير إلى أن الطرف الآخر فتح التطبيق أو لم يفتحه.
 * - التقاطع يُعرض بمنطقه الخاص وحده: تطابق إجابتين، لا مكافأة ولا اشتراط.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { PreferenceId, SakanRole, PartnerContext } from "@/types/sakan";
import { useBlindIntersection } from "@/lib/sakan/useBlindIntersection";
import CoRegulationTimer from "@/components/sakan/CoRegulationTimer";
import ForwardFocusBuilder from "@/components/sakan/ForwardFocusBuilder";

// ─── Passphrase gate ──────────────────────────────────────────────────────────

function PassphraseGate({ onSubmit }: { onSubmit: (passphrase: string) => void }) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) { inputRef.current?.focus(); return; }
    onSubmit(trimmed);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col items-center gap-5 w-full max-w-sm mx-auto"
    >
      <div className="text-center space-y-2">
        <div aria-hidden className="text-3xl">🌿</div>
        <p className="text-sm font-semibold text-stone-700">عبارة المرور المشتركة</p>
        <p className="text-xs text-stone-500 leading-relaxed">
          أدخلاها معاً على جهاز واحد لاستعراض ما يتشاركانه.
        </p>
      </div>
      <input
        ref={inputRef}
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="••••••••••••"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        dir="ltr"
        className="w-full rounded-xl border border-stone-200 bg-white/80 px-4 py-3 text-center text-base tracking-widest text-stone-700 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-500 transition-all"
        aria-label="عبارة المرور المشتركة"
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className="w-full rounded-xl py-3 px-6 text-white font-semibold text-sm shadow-sm transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2"
        style={{ background: "linear-gradient(135deg, #6b7f78 0%, #5c6e68 100%)" }}
      >
        استعراض المساحة المشتركة
      </button>
    </form>
  );
}

// ─── Loading state ────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <div
        className="w-10 h-10 rounded-full border-2 border-stone-200"
        style={{ borderTopColor: "#6b7f78", animation: "spin 2.5s linear infinite" }}
        aria-hidden
      />
      <p className="text-sm text-stone-500">…جارٍ الاسترداد والفك</p>
    </div>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div aria-hidden className="text-3xl">🕊️</div>
      <p className="text-sm text-stone-600 leading-relaxed max-w-xs">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="text-xs text-teal-700 underline underline-offset-2 hover:no-underline transition-all"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// المكوّن القابل للاختبار — SharedSpaceContent
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @testonly يُصدَّر لـ AT12 حصراً.
 * PartnerContext مُستقبَل ولا يُمرَّر للعرض — أي إضافة مشروطة به تُفشل AT12.
 */
export interface SharedSpaceContentProps {
  /** التقاطع المحسوب مسبقاً. */
  intersection: PreferenceId[];
  /** دالة تصيير بطاقة التقاطع — تُبقي المكوّن مستقلاً عن كتالوج التفضيلات. */
  renderItem: (id: PreferenceId, index: number) => React.ReactNode;
  /** رسالة الحالة الفارغة — محايدة سريرياً بلا لوم. */
  emptyMessage?: string;
  /** عبارة المرور لـ ForwardFocusBuilder. */
  passphrase: string;
  /** دور المستخدم على هذا الجهاز (لـ ForwardFocusBuilder). */
  role: SakanRole;
  /**
   * مُستقبَل لإتاحة AT12 — لا يُمرَّر إلى أي مكوّن عرض.
   * يمثّل وضع الطرف الآخر (أجاب / لم يجب) لكنه مخفيٌّ عن الواجهة تماماً.
   */
  partnerContext: PartnerContext;
  className?: string;
}

export function SharedSpaceContent({
  intersection,
  renderItem,
  emptyMessage = "ما تزال الأرضية المشتركة تتشكّل. استمرّا في مسيرتكما.",
  passphrase,
  role,
  // partnerContext مُستقبَل ولا يُمرَّر للعرض — أي إضافة مشروطة به تُفشل AT12
  className = "",
}: SharedSpaceContentProps) {
  return (
    <div
      className={`flex flex-col gap-10 w-full max-w-sm mx-auto px-5 py-8 ${className}`}
      dir="rtl"
    >
      {/* ── ١. التقاطع الأعمى ──────────────────────────────────────────────── */}
      {/* يُعرض ما تطابق فقط. ما لا يتقاطع لا وجود له في DOM. */}
      <section aria-labelledby="intersection-heading">
        <h2
          id="intersection-heading"
          className="text-xs text-stone-400 text-center mb-4 font-medium uppercase tracking-wide"
        >
          ما يتقاطع بينكما في هذه المرحلة
        </h2>

        {intersection.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span aria-hidden className="text-4xl">🌱</span>
            <p className="text-sm text-stone-600 leading-relaxed max-w-xs">
              {emptyMessage}
            </p>
          </div>
        ) : (
          <ul
            className="flex flex-col gap-2"
            role="list"
            aria-label="نقاط التقاطع المشتركة"
          >
            {intersection.map((id, i) => (
              <li key={id} role="listitem">
                {renderItem(id, i)}
              </li>
            ))}
          </ul>
        )}

        {/* تذكير الخصوصية — ثابت دائماً بغض النظر عن التقاطعات */}
        <div className="mt-4 bg-white/60 rounded-xl border border-stone-100 px-4 py-3">
          <p className="text-xs text-stone-400 text-center leading-relaxed">
            🔒 هذه النتائج تُعرض على جهازك فقط ولا تُخزَّن في أي مكان.
          </p>
        </div>
      </section>

      <div className="h-px bg-stone-100" aria-hidden />

      {/* ── ٢. مؤقت الوجود الصامت ─────────────────────────────────────────── */}
      {/* كل جهاز يشغّل مؤقته باستقلالية — لا تزامن، لا وضع "ناوِل الهاتف". */}
      <section aria-labelledby="timer-heading">
        <p
          id="timer-heading"
          className="text-xs text-stone-400 text-center mb-6"
        >
          وقت الحضور المشترك — جهازك يعمل باستقلالية
        </p>
        <CoRegulationTimer />
      </section>

      <div className="h-px bg-stone-100" aria-hidden />

      {/* ── ٣. قوالب الصياغة المستقبلية ─────────────────────────────────── */}
      {/* قوالب mad-libs تمنع الاتهام هيكلياً — "أحتاج إلى…" لا "كنت…". */}
      <section>
        <ForwardFocusBuilder passphrase={passphrase} role={role} />
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// الصفحة — SharedSpacePage
// ═══════════════════════════════════════════════════════════════════════════════

type PageStep =
  | "passphrase"
  | "loading"
  | "decrypting"
  | "done"
  | "error";

interface PageState {
  step: PageStep;
  passphrase: string;
  role: SakanRole;
  error: string | null;
}

/**
 * الصفحة الرئيسية للمساحة المشتركة.
 * تستخدم useBlindIntersection للجلب والفك، ثم تُفوِّض إلى SharedSpaceContent.
 *
 * coupleId: في التطبيق الكامل يأتي من معامل URL أو IDB.
 * هنا يُدخله المستخدم في نموذج عبارة المرور (الزوجان يتفقان عليه مسبقاً).
 */
export default function SharedSpacePage() {
  const [pageState, setPageState] = useState<PageState>({
    step: "passphrase",
    passphrase: "",
    role: "husband", // الجهاز يختار دوره — الافتراضي: زوج
    error: null,
  });

  // coupleId مبسَّط: نستخدم hash عبارة المرور كـ ID للزوجين (demo-only).
  // في الإنتاج يأتي من UUID مُولَّد عند إعداد الجلسة.
  const coupleIdFromPassphrase = pageState.passphrase
    ? `demo-${pageState.passphrase.slice(0, 8)}`
    : "";

  const { intersection, status, error, retry } = useBlindIntersection({
    coupleId: coupleIdFromPassphrase,
    couplePassphrase: pageState.passphrase,
    enabled: pageState.step === "loading" || pageState.step === "decrypting",
  });

  // ── مزامنة حالة الـ hook مع حالة الصفحة ─────────────────────────────────
  useEffect(() => {
    if (status === "loading")    setPageState((s) => ({ ...s, step: "loading" }));
    if (status === "decrypting") setPageState((s) => ({ ...s, step: "decrypting" }));
    if (status === "done")       setPageState((s) => ({ ...s, step: "done" }));
    if (status === "error")      setPageState((s) => ({ ...s, step: "error", error: error ?? null }));
  }, [status, error]);

  const handlePassphraseSubmit = useCallback((passphrase: string) => {
    setPageState((s) => ({ ...s, passphrase, step: "loading" }));
  }, []);

  const handleRetry = useCallback(() => {
    setPageState((s) => ({ ...s, passphrase: "", step: "passphrase", error: null }));
    retry();
  }, [retry]);

  // ── partnerContext: آلية داخلية — تُمرَّر ولا تُعرض ──────────────────────
  // يُشتقّ من `status` بعد نجاح الجلب:
  // "done" يعني أن كلا الطرفين أرسلا بياناتهما إلى الخادم.
  const partnerContext: PartnerContext = {
    partnerHasSubmitted: status === "done",
  };

  // ── العرض ────────────────────────────────────────────────────────────────────

  if (pageState.step === "passphrase") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12">
        <PassphraseGate onSubmit={handlePassphraseSubmit} />
      </div>
    );
  }

  if (pageState.step === "loading" || pageState.step === "decrypting") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingState />
      </div>
    );
  }

  if (pageState.step === "error") {
    return (
      <div className="flex items-center justify-center min-h-screen px-6">
        <ErrorState
          message={pageState.error ?? "حدث خطأ غير متوقع."}
          onRetry={handleRetry}
        />
      </div>
    );
  }

  // step === "done"
  return (
    <SharedSpaceContent
      intersection={intersection}
      renderItem={(id) => (
        <div
          className="rounded-xl px-4 py-3 bg-white/70 border border-stone-100 text-sm text-stone-700"
        >
          {id}
        </div>
      )}
      passphrase={pageState.passphrase}
      role={pageState.role}
      partnerContext={partnerContext}
    />
  );
}
