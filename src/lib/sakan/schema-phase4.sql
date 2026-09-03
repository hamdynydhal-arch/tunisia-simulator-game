-- ────────────────────────────────────────────────────────────────────────────
-- Sakan (سَكَن) — Phase 4 database migration
--
-- هذا الترحيل يُقلّص جدول sakan_sessions ليحتفظ فقط بالبيانات
-- الضرورية لـ Blind Intersection (التقاطع الأعمى).
--
-- جميع البيانات الشخصية (حالة المفتاح، خطة الغضب، السجلات، الرسائل،
-- الشروط) تُنقَل إلى IndexedDB المحلي على كل جهاز (src/lib/sakan/idb.ts).
--
-- يُطبَّق هذا الترحيل مرة واحدة على قاعدة البيانات الإنتاجية.
-- التأكد من أخذ نسخة احتياطية قبل التطبيق.
-- ────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ─── حذف أعمدة الأطراف الشخصية ─────────────────────────────────────────────
-- Phase 2 — Wife-only intimacy lock (now in wife's IndexedDB, key: 'KeyState')
ALTER TABLE sakan_sessions DROP COLUMN IF EXISTS lock_ciphertext;
ALTER TABLE sakan_sessions DROP COLUMN IF EXISTS lock_iv;
ALTER TABLE sakan_sessions DROP COLUMN IF EXISTS lock_salt;

-- Phase 3 — Husband's anger predictability plan (now in husband's IndexedDB, key: 'AngerPlan')
ALTER TABLE sakan_sessions DROP COLUMN IF EXISTS husband_anger_plan_ciphertext;
ALTER TABLE sakan_sessions DROP COLUMN IF EXISTS husband_anger_plan_iv;
ALTER TABLE sakan_sessions DROP COLUMN IF EXISTS husband_anger_plan_salt;

-- Phase 3 — Husband's dopamine recovery log → replaced by HusbandObservationLog in IndexedDB
ALTER TABLE sakan_sessions DROP COLUMN IF EXISTS husband_dopamine_log_ciphertext;
ALTER TABLE sakan_sessions DROP COLUMN IF EXISTS husband_dopamine_log_iv;
ALTER TABLE sakan_sessions DROP COLUMN IF EXISTS husband_dopamine_log_salt;

-- Phase 3 — Forward-focus messages (now per-device in IndexedDB, key: 'ForwardFocusMessage')
ALTER TABLE sakan_sessions DROP COLUMN IF EXISTS wife_message_ciphertext;
ALTER TABLE sakan_sessions DROP COLUMN IF EXISTS wife_message_iv;
ALTER TABLE sakan_sessions DROP COLUMN IF EXISTS wife_message_salt;
ALTER TABLE sakan_sessions DROP COLUMN IF EXISTS husband_message_ciphertext;
ALTER TABLE sakan_sessions DROP COLUMN IF EXISTS husband_message_iv;
ALTER TABLE sakan_sessions DROP COLUMN IF EXISTS husband_message_salt;

-- Phase 3 — Conditions for blind intersection (now per-device in IndexedDB, key: 'ConditionSelection')
ALTER TABLE sakan_sessions DROP COLUMN IF EXISTS wife_conditions_ciphertext;
ALTER TABLE sakan_sessions DROP COLUMN IF EXISTS wife_conditions_iv;
ALTER TABLE sakan_sessions DROP COLUMN IF EXISTS wife_conditions_salt;
ALTER TABLE sakan_sessions DROP COLUMN IF EXISTS husband_conditions_ciphertext;
ALTER TABLE sakan_sessions DROP COLUMN IF EXISTS husband_conditions_iv;
ALTER TABLE sakan_sessions DROP COLUMN IF EXISTS husband_conditions_salt;

-- ─── هيكل sakan_sessions بعد الترحيل ───────────────────────────────────────
-- id             uuid PRIMARY KEY
-- couple_id      text UNIQUE NOT NULL
-- husband_ciphertext  text        -- التقاطع الأعمى فقط
-- husband_iv          text
-- husband_salt        text
-- wife_ciphertext     text
-- wife_iv             text
-- wife_salt           text
-- created_at     timestamptz DEFAULT now()
-- updated_at     timestamptz DEFAULT now()

COMMIT;

-- ─── ملاحظة على RLS ──────────────────────────────────────────────────────────
-- سياسة RLS الحالية (couple_id = requesting couple_id) تظل صالحة بدون تغيير.
-- الجدول المُقلَّص يحتوي فقط على بيانات التقاطع الأعمى المشفّرة —
-- لا توجد بيانات شخصية على الخادم بعد هذا الترحيل.
