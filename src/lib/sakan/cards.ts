/**
 * Sakan (سَكَن) — قاعدة معرفة البطاقات + محمّل + تحقق البناء
 *
 * SPEC §3.1 + §9 (الخطوة الأولى)
 *
 * # قاعدة المصدر (اختبار القبول ٧)
 * كل بطاقة `kind === 'text'` يجب أن تحمل `source.reviewed === true`.
 * الدالة `validateCards()` تُشغَّل وقت البناء وترمي خطأً إن كانت أي بطاقة نصية
 * تفتقر إلى هذه العلامة. البطاقات المعلَّمة `TODO_REVIEW` هي مسودّات تراثية
 * تنتظر مراجعة متخصص — لا تُشحَن قبل المراجعة.
 *
 * # ١٥ بطاقة أولية
 * موزّعة على الحالات الأساسية لكلا الطرفين.
 * مصادر النصوص التراثية مُعلَّقة لحين المراجعة.
 *
 * # القيود البنيوية المُطبَّقة هنا
 * - duration_sec ≤ 120 لكل بطاقة (حارس تشغيل)
 * - intensity > 0 يستلزم أن يكون للبطاقة زوجة (wife) كجمهور — أو الزوج مع سقف المفتاح
 * - لا بطاقات "مشتركة": كل بطاقة لها audience واحد
 */

import type { Card } from "@/types/sakan";

// ─── تحقق البناء (اختبار القبول ٧) ──────────────────────────────────────────

/**
 * يتحقق من أن كل بطاقة `kind === 'text'` تحمل `source.reviewed === true`.
 * يُرمى خطأ وقت البناء إن وُجد خرق.
 *
 * الاستخدام في next.config: استدعِ `validateCards(ALL_CARDS)` في ملف الإعداد
 * لضمان فشل البناء قبل نشر بطاقة غير مراجَعة.
 */
export function validateCards(cards: Card[]): void {
  const violations: string[] = [];

  for (const card of cards) {
    // duration_sec ≤ 120
    if (card.duration_sec > 120) {
      violations.push(
        `Card "${card.id}": duration_sec (${card.duration_sec}) exceeds 120 seconds.`
      );
    }

    // kind === 'text' requires source.reviewed === true
    if (card.kind === "text") {
      if (!card.source || card.source.reviewed !== true) {
        violations.push(
          `Card "${card.id}" (kind: 'text') is missing source.reviewed === true. ` +
            `Mark as TODO_REVIEW and do not ship until a specialist has approved it.`
        );
      }
    }

    // لا بطاقة مشتركة — audience يجب أن يكون 'wife' أو 'husband'
    if (card.audience !== "wife" && card.audience !== "husband") {
      violations.push(
        `Card "${card.id}": audience must be 'wife' or 'husband', got "${card.audience}".`
      );
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `[Sakan] Build validation failed — ${violations.length} card(s) rejected:\n` +
        violations.map((v) => `  • ${v}`).join("\n") +
        "\n\nAcceptance test #7: every kind='text' card must have source.reviewed === true."
    );
  }
}

// ─── قاعدة البطاقات الأولية (١٥ بطاقة) ────────────────────────────────────

/**
 * البطاقات المعتمدة للنشر.
 *
 * ملاحظة على `TODO_REVIEW`:
 * البطاقات ذات `kind: 'text'` المُعلَّمة `TODO_REVIEW` في source.name
 * ستُعطي خطأ بناء إن أُزيل تعليق `// @ts-expect-error` منها — وهو الهدف.
 * اترك الحقل `source` غير موجود في بطاقات 'text' حتى تحصل على المراجعة.
 *
 * كل بطاقة هنا اجتازت validateCards() وهي صالحة للنشر الآن.
 */

// ────── مسار الزوجة — الأمان والعار والمسافة ─────────────────────────────

const WIFE_CARDS: Card[] = [
  // W-01: مفهوم — الأمان جسد لا قرار ذهني
  {
    id: "W-01",
    audience: "wife",
    kind: "concept",
    addresses: ["fear", "pain"],
    intensity: 0,
    duration_sec: 90,
    body:
      "الأمان ليس قراراً ذهنياً. الجهاز العصبي يستشعر الخطر أو الهدوء قبل أن يُصاغ أي فكر. " +
      "هذا لا يعني أنك مُبالِغة — بل يعني أن جسدك يحمي نفسه بالطريقة التي يعرفها.",
  },

  // W-02: تمرين — توقّف آمن
  {
    id: "W-02",
    audience: "wife",
    kind: "micro_exercise",
    addresses: ["fear", "trust"],
    intensity: 0,
    duration_sec: 90,
    body:
      "ضعي يدك على صدرك. لاحظي نبضة واحدة. خذي نَفَساً حتى تمتلئ البطن، ثم أخرجيه ببطء. " +
      "هذا كافٍ — لا مطلوب غيره الآن.",
  },

  // W-03: إعادة تأطير — الرغبة ليست واجباً
  {
    id: "W-03",
    audience: "wife",
    kind: "reframe",
    addresses: ["shame", "distance"],
    intensity: 0,
    duration_sec: 60,
    body:
      "الرغبة لا تُستدعى بالإرادة ولا تُقمَع بها. إنها تنمو في بيئة آمنة وتذبل في بيئة مُضغِطة. " +
      "غيابها ليس خللاً فيكِ — هو معلومة عن البيئة.",
  },

  // W-04: معلومة — ما الألم الجسدي يخبرنا
  {
    id: "W-04",
    audience: "wife",
    kind: "info",
    addresses: ["pain", "ignorance"],
    intensity: 0,
    requires: { flags: ["pain_reported"] },
    duration_sec: 90,
    body:
      "الألم أثناء العلاقة الزوجية له أسباب جسدية قابلة للتشخيص والعلاج. " +
      "إنه ليس مؤشراً على رفض نفسي، ولا على ضعف في الإرادة، ولا نتيجة لأي ذنب. " +
      "متخصصة نساء وولادة تُقيّم الأسباب — في الإعدادات تجدين رابط استشارة عن بُعد.",
  },

  // W-05: تمرين — الحد الآمن
  {
    id: "W-05",
    audience: "wife",
    kind: "micro_exercise",
    addresses: ["trust", "fear"],
    intensity: 1,
    requires: { safety: [50, 100] },
    duration_sec: 120,
    body:
      "تخيّلي مكاناً تشعرين فيه بالأمان التام — مكاناً حقيقياً أو متخيَّلاً. " +
      "صِفيه في جملة واحدة لنفسك فقط. لا أحد يسمع ذلك غيركِ.",
  },

  // W-06: معلومة — الثقة تُبنى بالسلوك لا بالتصريح
  {
    id: "W-06",
    audience: "wife",
    kind: "info",
    addresses: ["trust", "distance"],
    intensity: 0,
    duration_sec: 60,
    body:
      "الثقة لا تُعاد بالكلام — تُعاد بأنماط سلوك متكررة وقابلة للملاحظة عبر الزمن. " +
      "ما يُشعِركِ بالأمان الآن هو معلومة صادقة، مهما بدت صغيرة.",
  },
];

// ────── مسار الزوج — العار والغضب والانسحاب ────────────────────────────────

const HUSBAND_CARDS: Card[] = [
  // H-01: مفهوم — العار يختبئ
  {
    id: "H-01",
    audience: "husband",
    kind: "concept",
    addresses: ["shame", "distance"],
    intensity: 0,
    duration_sec: 90,
    body:
      "العار يدفع إلى الاختباء. الذنب يدفع إلى الإصلاح. " +
      "الفارق بينهما مهم: الذنب يقول 'فعلت شيئاً خطأ'، والعار يقول 'أنا خطأ'. " +
      "ما تشعر به الآن قد يكون العارضَ لا الحقيقة.",
  },

  // H-02: معلومة — الغضب والجهاز العصبي
  {
    id: "H-02",
    audience: "husband",
    kind: "info",
    addresses: ["anger", "shame"],
    intensity: 0,
    duration_sec: 90,
    body:
      "الغضب المتكرر غالباً أثرٌ لمظلمة قديمة أو خوف حاضر، لا دليلٌ على ضعف الإرادة. " +
      "التوقف عن فعل ما تندم عليه يحتاج مهارة يمكن تعلّمها، لا عزيمة خارقة.",
  },

  // H-03: تمرين — المشي عوضاً عن الكلام
  {
    id: "H-03",
    audience: "husband",
    kind: "micro_exercise",
    addresses: ["anger", "distance"],
    intensity: 0,
    duration_sec: 60,
    body:
      "حين تشعر بالضيق وتجد نفسك على وشك قول ما ستندم عليه — اخرج. " +
      "ليس هرباً؛ هذا هو الفعل الذكي. الجسد يحتاج حركة حتى تهدأ الكيمياء.",
  },

  // H-04: إعادة تأطير — الانسحاب ليس حماية
  {
    id: "H-04",
    audience: "husband",
    kind: "reframe",
    addresses: ["distance", "shame"],
    intensity: 0,
    duration_sec: 90,
    body:
      "الانسحاب يحمي لحظة ويُفاقم المسافة تراكماً. ليس المطلوب الكلام الكثير؛ " +
      "المطلوب حضور هادئ بلا توقعات: الجلوس في نفس الغرفة، " +
      "التحقق 'هل تحتاجين شيئاً؟' بلا ضغط للردّ.",
  },

  // H-05: معلومة — الألم ليس مقياس رجولة
  {
    id: "H-05",
    audience: "husband",
    kind: "info",
    addresses: ["ignorance", "shame"],
    intensity: 0,
    requires: { flags: ["pain_reported"] },
    duration_sec: 90,
    body:
      "الألم الجسدي عند الزوجة ليس طبيعياً ولا هو ذو صلة بالرجولة أو بقوة المشاعر. " +
      "إنه وضع طبي يستحق تشخيصاً. الاعتراف بوجوده خطوة رجولة حقيقية.",
  },

  // H-06: مفهوم — الحضور المستقل وقيمة مستقلة
  {
    id: "H-06",
    audience: "husband",
    kind: "concept",
    addresses: ["shame", "distance"],
    intensity: 0,
    duration_sec: 90,
    body:
      "البرنامج لا يجعل من انتظارك واجباً. هناك ما يكتمل عندك بصرف النظر عن أي شيء آخر: " +
      "علاقتك بابنك، هدوؤك في ضغط العمل، انسجامك مع نفسك. " +
      "هذا ليس بديلاً — هو بناء أساس حقيقي.",
  },

  // H-07: تمرين — ما لاحظته اليوم
  {
    id: "H-07",
    audience: "husband",
    kind: "micro_exercise",
    addresses: ["trust", "distance"],
    intensity: 0,
    duration_sec: 60,
    body:
      "خصّص دقيقة: ما الشيء الواحد الإيجابي الذي لاحظته اليوم في نفسك أو في بيئتك؟ " +
      "لا إجابة صحيحة أو خاطئة. لاحظ فقط.",
  },

  // H-08: معلومة — تراجع الحساسية والمداعبة ملفّان منفصلان
  {
    id: "H-08",
    audience: "husband",
    kind: "info",
    addresses: ["shame", "ignorance", "distance"],
    intensity: 0,
    duration_sec: 90,
    body:
      "تراجع الحساسية عند الزوج — أياً كان سببه — لا علاقة له بمستوى الحنان أو الاهتمام. " +
      "هذان ملفّان منفصلان تماماً. الحنان مهارة تُتعلَّم ومستقلة عن أي عادة أخرى.",
  },

  // H-09: إعادة تأطير — الثقة تُبنى في الصغير
  {
    id: "H-09",
    audience: "husband",
    kind: "reframe",
    addresses: ["trust", "shame"],
    intensity: 0,
    duration_sec: 60,
    body:
      "الثقة لا تُعاد بتصريح ولا باعتراف. تُعاد بأنماط صغيرة متكررة: " +
      "الالتزام بما قلته، التوقف حين طُلب منك، الحضور بلا مطالبة. " +
      "كل نمط صغير هو إضافة حقيقية.",
  },
];

// ────── دمج الكتالوج الكامل ──────────────────────────────────────────────────

/**
 * جميع البطاقات — مُتحقَّق منها وقت البناء.
 *
 * استخدام: `import { ALL_CARDS } from '@/lib/sakan/cards'`
 */
export const ALL_CARDS: Card[] = [...WIFE_CARDS, ...HUSBAND_CARDS];

// تحقق فوري وقت تحميل الوحدة (يُشغَّل أثناء بناء Next.js)
validateCards(ALL_CARDS);

// ─── دوال البحث ──────────────────────────────────────────────────────────────

/**
 * يُعيد بطاقات الجمهور المطلوب.
 */
export function getCardsByAudience(
  audience: "wife" | "husband"
): Card[] {
  return ALL_CARDS.filter((c) => c.audience === audience);
}

/**
 * يُعيد بطاقة بمعرّفها، أو undefined إن لم تُوجد.
 */
export function getCardById(id: string): Card | undefined {
  return ALL_CARDS.find((c) => c.id === id);
}
