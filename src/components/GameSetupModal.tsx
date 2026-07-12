"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";
import { useGameStore } from "@/store/gameStore";
import type { Difficulty } from "@/types/game";

/** Target side, in pixels, for the resized avatar — small enough to keep
 *  the Base64 string out of localStorage-quota trouble. */
const AVATAR_SIZE_PX = 128;

const PHILOSOPHY_SYMBOLS: readonly { emoji: string; label: string }[] = [
  { emoji: "👊", label: "قبضة حديدية" },
  { emoji: "🌹", label: "اجتماعي ديمقراطي" },
  { emoji: "⚔️", label: "عسكري" },
  { emoji: "⚖️", label: "تكنوقراط/عدالة" },
  { emoji: "🦅", label: "سيادي" },
];

/**
 * Reads an uploaded image, center-crops it to a square, and resizes it to
 * AVATAR_SIZE_PX via an off-screen canvas, returning a JPEG data URL. Every
 * failure path (unreadable file, decode error, canvas unavailable) resolves
 * `null` instead of throwing, so the caller can silently fall back to the
 * placeholder rather than crash the setup wizard over a bad image.
 */
function resizeImageToDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onerror = () => resolve(null);
      reader.onload = () => {
        try {
          const img = new Image();
          img.onerror = () => resolve(null);
          img.onload = () => {
            try {
              const canvas = document.createElement("canvas");
              canvas.width = AVATAR_SIZE_PX;
              canvas.height = AVATAR_SIZE_PX;
              const ctx = canvas.getContext("2d");
              if (!ctx) {
                resolve(null);
                return;
              }
              // Center-crop to a square first so portraits aren't squashed.
              const side = Math.min(img.width, img.height);
              const sx = (img.width - side) / 2;
              const sy = (img.height - side) / 2;
              ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE_PX, AVATAR_SIZE_PX);
              resolve(canvas.toDataURL("image/jpeg", 0.85));
            } catch {
              resolve(null);
            }
          };
          img.src = String(reader.result);
        } catch {
          resolve(null);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      resolve(null);
    }
  });
}

// The 33-66-99 scaling: each tier's absolute values, mirroring gameStore.ts's
// EASY_*/HARD_* starting-conditions constants (display copy only).
const NORMAL_STARTING_BUDGET_TND = 5_000;
const NORMAL_STARTING_HARD_CURRENCY_USD = 2_400;
const EASY_STARTING_BUDGET_TND = 7_500;
const EASY_STARTING_HARD_CURRENCY_USD = 3_600;
const HARD_STARTING_BUDGET_TND = 2_500;
const HARD_STARTING_HARD_CURRENCY_USD = 0;
const HARD_STARTING_SOVEREIGN_DEBT_TND = 1_000;

/** Explicit comma-grouped thousands, e.g. "7,500 مليون دينار" — distinct
 *  from the rest of the app's ar-TN (period-grouped) `formatMillions`,
 *  scoped to this briefing view only per the exact copy requested. */
function formatMillionsComma(value: number, unit: "دينار" | "دولار"): string {
  return `${value.toLocaleString("en-US")} مليون ${unit}`;
}

// Win/loss thresholds mirror gameStore.ts's HISTORICAL_TRIUMPH_*/COLLAPSE_*/
// CRITICAL_STABILITY_* constants — display copy only, not re-derived logic.
const WIN_STABILITY_THRESHOLD = 85;
const WIN_PURCHASING_POWER_THRESHOLD = 60;
const COLLAPSE_STABILITY = 15;
const COLLAPSE_BUDGET_TND = 2_000;
const SUSTAINED_COLLAPSE_STABILITY = 25;
const SUSTAINED_COLLAPSE_MONTHS = 3;

const DIFFICULTIES: readonly {
  key: Difficulty;
  label: string;
  icon: string;
  description: string;
}[] = [
  {
    key: "easy",
    label: "مسار شعبوي",
    icon: "📢",
    description: "ميزانية ضخمة 7500م د.ت واحتياطي 3600م$. تهرب ضريبي منخفض جداً.",
  },
  {
    key: "normal",
    label: "حكومة تكنوقراط",
    icon: "⚖️",
    description: "الوضع الأساسي القياسي: ميزانية 5000م د.ت واحتياطي 2400م$.",
  },
  {
    key: "hard",
    label: "رجل دولة",
    icon: "🎖️",
    description: "ديون سيادية خانقة 1000م د.ت، صفر احتياطي $، وتهرب ضريبي مستفحل (+30%).",
  },
];

function startingStatsFor(difficulty: Difficulty) {
  if (difficulty === "easy") {
    return {
      budget: EASY_STARTING_BUDGET_TND,
      hardCurrency: EASY_STARTING_HARD_CURRENCY_USD,
      sovereignDebt: 0,
      shadowNote: "تقلص بـ 30% (ميزة)",
    };
  }
  if (difficulty === "hard") {
    return {
      budget: HARD_STARTING_BUDGET_TND,
      hardCurrency: HARD_STARTING_HARD_CURRENCY_USD,
      sovereignDebt: HARD_STARTING_SOVEREIGN_DEBT_TND,
      shadowNote: "تضخم بـ 30% (عقوبة)",
    };
  }
  return {
    budget: NORMAL_STARTING_BUDGET_TND,
    hardCurrency: NORMAL_STARTING_HARD_CURRENCY_USD,
    sovereignDebt: 0,
    shadowNote: "معدل طبيعي (بلا تغيير)",
  };
}

/**
 * The Inauguration: a 3-step wizard (persona → difficulty → briefing) that
 * gates the very first tick. Renders exactly while `gameStarted === false` —
 * `startGame` (called by the final step's oath button) flips it true and
 * applies the chosen difficulty tier's one-time starting-conditions
 * overrides, permanently dismissing this modal for the rest of the campaign.
 */
export default function GameSetupModal() {
  const gameStarted = useGameStore((state) => state.gameState.gameStarted);
  const startGame = useGameStore((state) => state.startGame);

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [playerName, setPlayerName] = useState("");
  const [partyName, setPartyName] = useState("");
  const [slogan, setSlogan] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [philosophySymbol, setPhilosophySymbol] = useState(
    PHILOSOPHY_SYMBOLS[0].emoji,
  );

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file later
    if (!file) {
      return;
    }
    setAvatarError(false);
    const resized = await resizeImageToDataUrl(file);
    if (resized) {
      setAvatar(resized);
    } else {
      setAvatarError(true);
    }
  };

  if (gameStarted) {
    return null;
  }

  const personaValid =
    playerName.trim().length > 0 && partyName.trim().length > 0;
  const stats = startingStatsFor(difficulty);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/80 p-4 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="مراسم التنصيب"
        className="animate-grand-entrance relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-black p-6 shadow-2xl sm:p-8"
      >
        {/* Cinematic Lighting: an ambient, breathing crimson glow behind the
            whole interface — the "blood of history" against the void. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-red-900/15 blur-[120px]"
        />

        <div className="relative">
          <div className="mb-6 flex items-center justify-center gap-2">
            {([0, 1, 2] as const).map((s) => (
              <div
                key={s}
                className={`h-1.5 w-10 rounded-full transition-colors ${
                  s <= step ? "bg-red-600" : "bg-white/10"
                }`}
              />
            ))}
          </div>

          {step === 0 && (
            <div>
              <img
                src="/logo.svg"
                alt="شعار محاكي تونس"
                className="mx-auto mb-6 h-32 w-32 drop-shadow-2xl md:h-40 md:w-40"
              />
              <h2 className="text-center text-xl font-bold tracking-wide text-white">
                مراسم التنصيب
              </h2>
              <p className="mt-1 text-center text-sm text-white/50">
                من أنت أيها الرئيس القادم؟
              </p>
              <div className="mt-6 space-y-5">
                <div>
                  <label className="group flex cursor-pointer flex-col items-center gap-3 sm:flex-row">
                    <div className="relative h-20 w-20 shrink-0">
                      {avatar ? (
                        <img
                          src={avatar}
                          alt="صورة الرئيس"
                          className="h-20 w-20 object-cover"
                        />
                      ) : (
                        <div
                          role="img"
                          aria-label="لا توجد صورة"
                          className="flex h-20 w-20 items-center justify-center bg-black text-3xl text-white/30"
                        >
                          👤
                        </div>
                      )}
                      {/* Strategic Targeting Reticle: glowing corner brackets
                          that contract inward on hover, like a target lock. */}
                      <span
                        aria-hidden="true"
                        className="absolute -left-1.5 -top-1.5 h-5 w-5 border-l-2 border-t-2 border-red-600 shadow-[0_0_8px_rgba(220,38,38,0.6)] transition-transform duration-300 group-hover:translate-x-1 group-hover:translate-y-1"
                      />
                      <span
                        aria-hidden="true"
                        className="absolute -right-1.5 -top-1.5 h-5 w-5 border-r-2 border-t-2 border-red-600 shadow-[0_0_8px_rgba(220,38,38,0.6)] transition-transform duration-300 group-hover:-translate-x-1 group-hover:translate-y-1"
                      />
                      <span
                        aria-hidden="true"
                        className="absolute -bottom-1.5 -left-1.5 h-5 w-5 border-b-2 border-l-2 border-red-600 shadow-[0_0_8px_rgba(220,38,38,0.6)] transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1"
                      />
                      <span
                        aria-hidden="true"
                        className="absolute -bottom-1.5 -right-1.5 h-5 w-5 border-b-2 border-r-2 border-red-600 shadow-[0_0_8px_rgba(220,38,38,0.6)] transition-transform duration-300 group-hover:-translate-x-1 group-hover:-translate-y-1"
                      />
                    </div>
                    <span className="text-center text-xs font-bold uppercase tracking-widest text-white/40 transition-colors group-hover:text-white/70 sm:text-start">
                      {avatar ? "تغيير الصورة" : "رفع صورة شخصية (اختياري)"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </label>
                  {avatarError && (
                    <p className="mt-2 text-xs font-semibold text-red-500">
                      تعذر تحميل الصورة — جرّب صورة أخرى.
                    </p>
                  )}
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-white/40">
                    اسم الرئيس
                  </span>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(event) => setPlayerName(event.target.value)}
                    placeholder="مثال: الطيب الوزير"
                    className="w-full border-b border-white/20 bg-transparent px-1 py-2 text-sm text-white/90 outline-none transition-all placeholder:text-white/25 focus:border-red-600 focus:text-white focus:shadow-[0_4px_20px_-2px_rgba(220,38,38,0.6)]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-white/40">
                    اسم الحزب/الحركة
                  </span>
                  <input
                    type="text"
                    value={partyName}
                    onChange={(event) => setPartyName(event.target.value)}
                    placeholder="مثال: حزب القوة"
                    className="w-full border-b border-white/20 bg-transparent px-1 py-2 text-sm text-white/90 outline-none transition-all placeholder:text-white/25 focus:border-red-600 focus:text-white focus:shadow-[0_4px_20px_-2px_rgba(220,38,38,0.6)]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-white/40">
                    الشعار (اختياري)
                  </span>
                  <input
                    type="text"
                    value={slogan}
                    onChange={(event) => setSlogan(event.target.value)}
                    placeholder="مثال: تونس أولاً"
                    className="w-full border-b border-white/20 bg-transparent px-1 py-2 text-sm text-white/90 outline-none transition-all placeholder:text-white/25 focus:border-red-600 focus:text-white focus:shadow-[0_4px_20px_-2px_rgba(220,38,38,0.6)]"
                  />
                </label>
                <div>
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-white/40">
                    الرمز الفكري
                  </span>
                  <div
                    role="radiogroup"
                    aria-label="الرمز الفكري"
                    className="grid grid-cols-5 gap-2"
                  >
                    {PHILOSOPHY_SYMBOLS.map((symbol) => (
                      <button
                        key={symbol.emoji}
                        type="button"
                        role="radio"
                        aria-checked={philosophySymbol === symbol.emoji}
                        title={symbol.label}
                        onClick={() => setPhilosophySymbol(symbol.emoji)}
                        className={`rounded-lg border p-2 text-xl transition-all duration-300 ${
                          philosophySymbol === symbol.emoji
                            ? "scale-105 border-red-600 bg-red-950/30 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)] grayscale-0"
                            : "border-white/10 bg-black text-white/50 grayscale hover:border-white/20"
                        }`}
                      >
                        {symbol.emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={!personaValid}
                title={
                  personaValid
                    ? undefined
                    : "أدخل اسم الرئيس واسم الحزب للمتابعة"
                }
                className="mt-6 w-full rounded-lg bg-gradient-to-r from-red-700 to-red-950 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-950/50 ring-1 ring-red-600/30 transition-all hover:from-red-600 hover:to-red-900 disabled:cursor-not-allowed disabled:from-white/10 disabled:to-white/10 disabled:text-white/30 disabled:ring-0"
              >
                التالي
              </button>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="text-center text-xl font-bold tracking-wide text-white">
                اختر مستوى الحكم
              </h2>
              <p className="mt-1 text-center text-sm text-white/50">
                كل مسار يبدأ من ظروف اقتصادية مختلفة
              </p>
              <div className="mt-6 space-y-3">
                {DIFFICULTIES.map((tier) => (
                  <button
                    key={tier.key}
                    type="button"
                    onClick={() => setDifficulty(tier.key)}
                    aria-pressed={difficulty === tier.key}
                    className={`w-full rounded-lg border p-3 text-start transition-all duration-300 ${
                      difficulty === tier.key
                        ? "scale-[1.02] border-red-600 bg-red-950/30 shadow-[0_0_20px_rgba(220,38,38,0.35)]"
                        : "border-white/10 bg-black hover:border-white/20 hover:bg-white/[0.03]"
                    }`}
                  >
                    <span
                      className={`flex items-center gap-2 text-sm font-bold ${
                        difficulty === tier.key ? "text-white" : "text-white/70"
                      }`}
                    >
                      <span>{tier.icon}</span>
                      {tier.label}
                    </span>
                    <span className="mt-1 block text-xs text-white/40">
                      {tier.description}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="w-full rounded-lg border border-white/10 px-4 py-2.5 text-sm font-bold text-white/50 transition-colors hover:bg-white/5"
                >
                  رجوع
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full rounded-lg bg-gradient-to-r from-red-700 to-red-950 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-950/50 ring-1 ring-red-600/30 transition-all hover:from-red-600 hover:to-red-900"
                >
                  التالي
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-center text-xl font-bold tracking-wide text-white">
                الإحاطة الرئاسية
              </h2>
              <p className="mt-1 text-center text-sm text-white/50">
                الرئيس {playerName} · {partyName}
              </p>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">
                  نقطة الانطلاق
                </h3>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-white/40">الميزانية</dt>
                    <dd className="font-bold text-white">
                      {formatMillionsComma(stats.budget, "دينار")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-white/40">العملة الصعبة</dt>
                    <dd className="font-bold text-white">
                      {formatMillionsComma(stats.hardCurrency, "دولار")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-white/40">الدين السيادي</dt>
                    <dd className="font-bold text-white">
                      {formatMillionsComma(stats.sovereignDebt, "دينار")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-white/40">الاقتصاد الموازي</dt>
                    <dd className="font-bold text-white">
                      {stats.shadowNote}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="mt-3 rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                  شروط الانتصار (العبور التاريخي)
                </h3>
                <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-emerald-100/80">
                  <li>سداد الدين السيادي بالكامل (0)</li>
                  <li>استقرار وطني {WIN_STABILITY_THRESHOLD}+/100</li>
                  <li>صفر إضرابات عامة نشطة</li>
                  <li>مقدرة شرائية {WIN_PURCHASING_POWER_THRESHOLD}+/100</li>
                </ul>
              </div>

              <div className="mt-3 rounded-xl border border-red-700/40 bg-red-950/20 p-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-red-400">
                  شروط السقوط
                </h3>
                <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-red-100/80">
                  <li>انهيار فوري: استقرار وطني دون {COLLAPSE_STABILITY}/100</li>
                  <li>
                    إفلاس فوري: ميزانية الدولة تنخفض دون -{COLLAPSE_BUDGET_TND}م
                    د.ت
                  </li>
                  <li>
                    سقوط تدريجي: استقرار دون {SUSTAINED_COLLAPSE_STABILITY} لمدة{" "}
                    {SUSTAINED_COLLAPSE_MONTHS} أشهر متتالية
                  </li>
                </ul>
              </div>

              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full rounded-lg border border-white/10 px-4 py-2.5 text-sm font-bold text-white/50 transition-colors hover:bg-white/5"
                >
                  رجوع
                </button>
                <button
                  type="button"
                  onClick={() =>
                    startGame(
                      playerName.trim(),
                      partyName.trim(),
                      slogan.trim(),
                      difficulty,
                      avatar,
                      philosophySymbol,
                    )
                  }
                  className="w-full rounded-lg bg-gradient-to-r from-red-700 to-red-950 px-4 py-2.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(220,38,38,0.4)] ring-1 ring-red-600/40 transition-all hover:from-red-600 hover:to-red-900"
                >
                  أداء اليمين الدستورية
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
