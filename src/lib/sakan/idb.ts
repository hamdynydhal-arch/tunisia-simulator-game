/**
 * Sakan (سَكَن) — Encrypted Local Storage (IndexedDB)
 *
 * طبقة التخزين المحلي المشفّرة.
 *
 * كل طرف يملك قاعدة بيانات مستقلة على جهازه. البيانات لا تغادر الجهاز.
 * التشفير يستخدم نفس آلية crypto.ts (AES-GCM 256 + PBKDF2-SHA256).
 *
 * # مبدأ الفصل البنيوي
 * حقل `KeyState` مُعرَّف فقط في مخطط قاعدة الزوجة.
 * قاعدة الزوج لا تملك الحقل من الأساس — عزل بالبنية لا بالسياسة.
 * هذا ما يضمنه اختبار القبول رقم ٩.
 *
 * # مخطط البيانات
 * كل قيمة مخزَّنة هي EncryptedPayload مُسلسَل بـ JSON (سلسلة نصية واحدة).
 * مفتاح PBKDF2 مشتق من عبارة المرور المخزَّنة في sessionStorage فقط.
 *
 * # قواعد الكتابة
 * - writeWife()  — يقبل فقط المفاتيح في WIFE_STORE_KEYS
 * - writeHusband() — يقبل فقط المفاتيح في HUSBAND_STORE_KEYS
 * - لا توجد دالة كتابة عامة: هذا التصميم يمنع كتابة KeyState في قاعدة الزوج حتى بالخطأ.
 */

import type { EncryptedPayload } from "@/types/sakan";
import { encrypt, decrypt } from "@/lib/sakan/crypto";

// ─── Store key schemas ────────────────────────────────────────────────────────

/**
 * المفاتيح الصالحة في مخزن الزوجة.
 * KeyState موجود هنا ومُمنوع تماماً من مخزن الزوج.
 */
export const WIFE_STORE_KEYS = {
  KeyState: true,
  ForwardFocusMessage: true,
  ConditionSelection: true,
  Observations: true,
  State: true,
  LearningState: true,
} as const satisfies Record<string, true>;

export type WifeStoreKey = keyof typeof WIFE_STORE_KEYS;

/**
 * المفاتيح الصالحة في مخزن الزوج.
 * لا يوجد KeyState هنا إطلاقاً — هذا هو الضمان البنيوي لاختبار القبول ٩.
 */
export const HUSBAND_STORE_KEYS = {
  AngerPlan: true,
  ForwardFocusMessage: true,
  ConditionSelection: true,
  Observations: true,
  State: true,
  LearningState: true,
} as const satisfies Record<string, true>;

export type HusbandStoreKey = keyof typeof HUSBAND_STORE_KEYS;

/**
 * المفاتيح الحصرية للزوجة — موجودة في WIFE_STORE_KEYS ومغيَّبة من HUSBAND_STORE_KEYS.
 * تُستخدم في اختبار القبول ٩ للتحقق من غياب التقاطع.
 */
export const WIFE_ONLY_KEYS: string[] = Object.keys(WIFE_STORE_KEYS).filter(
  (k) => !(k in HUSBAND_STORE_KEYS)
);

// ─── Database configuration ───────────────────────────────────────────────────

const DB_VERSION = 1;
const WIFE_DB_NAME = "sakan-wife";
const HUSBAND_DB_NAME = "sakan-husband";
const STORE_NAME = "encrypted"; // single object store in each DB

// ─── Low-level IndexedDB helpers ─────────────────────────────────────────────

function openDb(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = () => reject(new Error(`[Sakan IDB] Cannot open "${name}": ${req.error?.message}`));
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result as string | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, key: string, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function idbClearAll(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── Database singletons ──────────────────────────────────────────────────────

let _wifeDb: IDBDatabase | null = null;
let _husbandDb: IDBDatabase | null = null;

async function getWifeDb(): Promise<IDBDatabase> {
  if (!_wifeDb) _wifeDb = await openDb(WIFE_DB_NAME);
  return _wifeDb;
}

async function getHusbandDb(): Promise<IDBDatabase> {
  if (!_husbandDb) _husbandDb = await openDb(HUSBAND_DB_NAME);
  return _husbandDb;
}

// ─── ترحيل صامت للبيانات القائمة ─────────────────────────────────────────────

/**
 * الحقل `earnedCeilingLevel` أُعيدت تسميته إلى `earnedCeiling`.
 * السبب: كلمة "Level" كانت تُوقعه تحت التعبير المحظور في §8.3
 * (`/streak|progress|completed_days|score|level/i`) رغم أنه سقف علاجي
 * لا عدّاد إنجاز. القاعدة بلا استثناء أمتن من قاعدة بحارس يحرس استثناءها.
 *
 * الأجهزة التي كتبت الاسم القديم قبل التغيير تُقرأ هنا وتُحوَّل:
 * - **بلا فقدان:** القيمة تُنقل كما هي إلى الاسم الجديد.
 * - **بلا أثر مرئي:** لا رسالة، ولا سجلّ، ولا إعادة كتابة فورية.
 *   الشكل الجديد يُحفظ طبيعياً عند أول كتابة تالية.
 * - **بلا أولوية على الجديد:** إن وُجد الاسمان معاً فالجديد هو المُعتمَد.
 *
 * الترحيل يُطبَّق على كل قراءة من المخزنين، فأي مفتاح يحمل الحقل يُغطَّى.
 */
const LEGACY_CEILING_FIELD = "earnedCeilingLevel";

export function migrateStoredValue<T>(value: T): T {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;
  if (!(LEGACY_CEILING_FIELD in record)) return value;

  const { [LEGACY_CEILING_FIELD]: legacy, ...rest } = record;

  // الاسم الجديد — إن وُجد — يعلو على القديم؛ وإلا تُنقل قيمة القديم كما هي
  return {
    ...rest,
    earnedCeiling: "earnedCeiling" in rest ? rest.earnedCeiling : legacy,
  } as T;
}

// ─── Typed write helpers ──────────────────────────────────────────────────────

/**
 * يكتب قيمة مشفّرة في قاعدة الزوجة.
 * المفاتيح المقبولة محدودة بـ WifeStoreKey — يشمل KeyState.
 */
export async function writeWife<T>(
  key: WifeStoreKey,
  value: T,
  passphrase: string
): Promise<void> {
  const payload: EncryptedPayload = await encrypt(value, passphrase);
  const db = await getWifeDb();
  await idbPut(db, key, JSON.stringify(payload));
}

/**
 * يقرأ ويفكّ تشفير قيمة من قاعدة الزوجة.
 * يُعيد null إن لم تكن القيمة موجودة أو فشل فكّ التشفير.
 */
export async function readWife<T>(
  key: WifeStoreKey,
  passphrase: string
): Promise<T | null> {
  const db = await getWifeDb();
  const raw = await idbGet(db, key);
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw) as EncryptedPayload;
    return migrateStoredValue(await decrypt<T>(payload, passphrase));
  } catch {
    return null;
  }
}

/**
 * يكتب قيمة مشفّرة في قاعدة الزوج.
 * المفاتيح المقبولة محدودة بـ HusbandStoreKey — لا يشمل KeyState.
 *
 * @note TypeScript يمنع استخدام 'KeyState' كـ key في هذه الدالة عند وقت الترجمة.
 *       اختبار القبول ٩ يؤكد الضمان البنيوي على مستوى ثابتات المخطط.
 */
export async function writeHusband<T>(
  key: HusbandStoreKey,
  value: T,
  passphrase: string
): Promise<void> {
  const payload: EncryptedPayload = await encrypt(value, passphrase);
  const db = await getHusbandDb();
  await idbPut(db, key, JSON.stringify(payload));
}

/**
 * يقرأ ويفكّ تشفير قيمة من قاعدة الزوج.
 */
export async function readHusband<T>(
  key: HusbandStoreKey,
  passphrase: string
): Promise<T | null> {
  const db = await getHusbandDb();
  const raw = await idbGet(db, key);
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw) as EncryptedPayload;
    return migrateStoredValue(await decrypt<T>(payload, passphrase));
  } catch {
    return null;
  }
}

/**
 * يحذف حقلاً من قاعدة الزوجة.
 */
export async function deleteWife(key: WifeStoreKey): Promise<void> {
  const db = await getWifeDb();
  await idbDelete(db, key);
}

/**
 * يحذف حقلاً من قاعدة الزوج.
 */
export async function deleteHusband(key: HusbandStoreKey): Promise<void> {
  const db = await getHusbandDb();
  await idbDelete(db, key);
}

// ─── Emergency wipe (زر المسح الفوري — SPEC §7) ──────────────────────────────

/**
 * يمسح جميع البيانات المحلية لكلا الجهازين (تُستدعى من صفحة الإعدادات).
 * لا يلمس Supabase — التقاطع الأعمى يظل هناك.
 */
export async function wipeAllLocalData(): Promise<void> {
  const [wife, husband] = await Promise.all([getWifeDb(), getHusbandDb()]);
  await Promise.all([idbClearAll(wife), idbClearAll(husband)]);
}
