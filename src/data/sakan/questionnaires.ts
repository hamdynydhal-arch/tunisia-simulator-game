/**
 * Sakan (سَكَن) — Week Zero questionnaire data
 *
 * Two completely separate forms: one for the wife, one for the husband.
 * Language is clinically neutral: no blame, no labels, no direct references
 * to past traumatic events.  All phrasing is forward-looking and present-tense.
 *
 * Architectural rules enforced here:
 * - Absolute Secrecy: wife's form is never shown in the husband's session and vice-versa.
 * - Forward-Focus: questions probe current states and future capacity, not past failures.
 * - No Medical Triggers: scale anchors and option labels use everyday Arabic.
 */

import type { SakanQuestionnaire } from "@/types/sakan";

// ─── Wife's Form ─────────────────────────────────────────────────────────────

export const wifeQuestionnaire: SakanQuestionnaire = {
  role: "wife",
  title: "أسئلة أسبوع الصفر",
  subtitle:
    "لا توجد إجابات صحيحة أو خاطئة. أجيبي بما تشعرين به الآن، وتجاوزي أي سؤال لا تريدين الإجابة عنه.",
  questions: [
    // 1. Childbirth effects — phrased around current physical comfort
    {
      id: "w_physical_comfort",
      type: "scale",
      text: "كيف تصفين شعورك الجسدي العام في هذه المرحلة؟",
      minLabel: "صعب ومرهق",
      maxLabel: "مريح ومستقر",
      note: "هذا السؤال عن جسدكِ وراحته في الوقت الحالي، لا شيء أكثر من ذلك.",
    },

    // 2. Fear of new pregnancy — phrased as general concern about life changes
    {
      id: "w_future_change_anxiety",
      type: "scale",
      text: "ما مستوى قلقكِ من التغييرات التي قد تطرأ على حياتكِ اليومية مستقبلًا؟",
      minLabel: "لا قلق على الإطلاق",
      maxLabel: "قلق كبير",
      note: "أي تغييرات تخطر ببالكِ، سواء كانت عملية أو أسرية أو جسدية.",
    },

    // 3. Privacy space — shared question, separate instances
    {
      id: "w_home_privacy",
      type: "scale",
      text: "كيف تصفين مستوى الخصوصية والهدوء المتاح لكما في المنزل حاليًا؟",
      minLabel: "نادرًا نجد خصوصية",
      maxLabel: "لدينا خصوصية كافية",
    },

    // 4. Safety / fear regarding husband — the most sensitive question, triple-softened
    {
      id: "w_safety_level",
      type: "scale",
      text: "كيف تصفين مستوى الشعور بالأمان والهدوء حين تكونين بالقرب منه؟",
      minLabel: "أشعر بقلق أو توتر",
      maxLabel: "أشعر بأمان واطمئنان",
      note: "إجابتكِ خاصة تمامًا بكِ ولن يراها أحد. أجيبي بصدق — هذا السؤال لصالحكِ.",
    },

    // 5. Open-ended safety net
    {
      id: "w_open_notes",
      type: "textarea",
      text: "هل هناك شيء تودّين أن يُؤخذ بالاعتبار في هذه المرحلة؟",
      placeholder: "اكتبي ما تشاءين، أو اتركي هذا الحقل فارغًا.",
      optional: true,
    },
  ],
};

// ─── Husband's Form ──────────────────────────────────────────────────────────

export const husbandQuestionnaire: SakanQuestionnaire = {
  role: "husband",
  title: "أسئلة أسبوع الصفر",
  subtitle:
    "لا توجد إجابات صحيحة أو خاطئة. أجب بما تشعر به الآن، وتجاوز أي سؤال لا تريد الإجابة عنه.",
  questions: [
    // 1. Anger management — framed as self-regulation capacity
    {
      id: "h_emotional_regulation",
      type: "scale",
      text: "كيف تصف قدرتك على البقاء هادئًا في المواقف الضاغطة مؤخرًا؟",
      minLabel: "أجد صعوبة كبيرة",
      maxLabel: "أتعامل معها بهدوء",
      note: "لا يهم ما حدث في الماضي — هذا عن قدرتك في الوقت الحالي.",
    },

    // 2. Emotional numbing / alternative outlets — multiselect, non-accusatory
    {
      id: "h_coping_outlets",
      type: "multiselect",
      text: "حين تشعر بالتوتر أو الإرهاق العاطفي، ما الذي تلجأ إليه عادةً؟",
      note: "اختر كل ما ينطبق. الهدف هو الفهم، ليس الحكم.",
      options: [
        { value: "sleep_rest",    label: "النوم أو الراحة" },
        { value: "walk_outdoors", label: "الخروج والمشي أو الرياضة" },
        { value: "screens",       label: "الإنترنت أو الشاشات" },
        { value: "food",          label: "الطعام" },
        { value: "talking",       label: "التحدث مع صديق أو شخص تثق به" },
        { value: "isolation",     label: "الانعزال والصمت" },
        { value: "other",         label: "أشياء أخرى" },
      ],
    },

    // 3. Privacy space — shared question, separate instance
    {
      id: "h_home_privacy",
      type: "scale",
      text: "كيف تصف مستوى الخصوصية والهدوء المتاح لكما في المنزل حاليًا؟",
      minLabel: "نادرًا نجد خصوصية",
      maxLabel: "لدينا خصوصية كافية",
    },

    // 4. Predictability / stability signal
    {
      id: "h_daily_stability",
      type: "scale",
      text: "كيف تصف مستوى الاستقرار والانتظام في روتينك اليومي هذه الأيام؟",
      minLabel: "غير مستقر تمامًا",
      maxLabel: "مستقر ومنتظم",
      note: "الانتظام في الروتين يُشعر من حولك بالأمان التلقائي.",
    },

    // 5. Open-ended safety net
    {
      id: "h_open_notes",
      type: "textarea",
      text: "هل هناك شيء تودّ أن يُؤخذ بالاعتبار في هذه المرحلة؟",
      placeholder: "اكتب ما تشاء، أو اترك هذا الحقل فارغًا.",
      optional: true,
    },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the appropriate questionnaire for a given role. */
export function getQuestionnaire(role: "wife" | "husband"): SakanQuestionnaire {
  return role === "wife" ? wifeQuestionnaire : husbandQuestionnaire;
}
