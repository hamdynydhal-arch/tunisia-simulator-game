/**
 * Sakan (سَكَن) — Client-side End-to-End Encryption
 *
 * Uses the Web Crypto API (SubtleCrypto) — available in all modern browsers and
 * in the Next.js static-export runtime. No server has access to the key or the
 * plaintext.  Only the ciphertext + iv + salt (all Base64url) are stored in
 * Supabase.
 *
 * Algorithm: AES-GCM 256-bit with a 12-byte random IV per encrypt call.
 * Key derivation: PBKDF2-SHA256, 310 000 iterations (OWASP 2023 recommendation),
 * 16-byte random salt per key-derivation call.
 *
 * The passphrase NEVER leaves the device.  Keys are not persisted anywhere —
 * they are re-derived from the passphrase on every session.
 */

import type { EncryptedPayload } from "@/types/sakan";

// ─── Encoding helpers ────────────────────────────────────────────────────────

function base64urlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const b64 = padded + "=".repeat(padLen);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

// ─── Key derivation ──────────────────────────────────────────────────────────

/**
 * Derives an AES-GCM 256 CryptoKey from a user passphrase and a salt.
 * The salt should be stored alongside the ciphertext (it is not secret).
 */
async function deriveKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 310_000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ─── Encrypt ─────────────────────────────────────────────────────────────────

/**
 * Encrypts any JSON-serialisable value with the provided passphrase.
 * Returns an EncryptedPayload safe to store in Supabase.
 *
 * @param value   - The plaintext value (will be JSON.stringify'd)
 * @param passphrase - The user's private passphrase (stays on-device)
 */
export async function encrypt(
  value: unknown,
  passphrase: string
): Promise<EncryptedPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16)) as Uint8Array<ArrayBuffer>;
  const iv = crypto.getRandomValues(new Uint8Array(12)) as Uint8Array<ArrayBuffer>;
  const key = await deriveKey(passphrase, salt);

  const plaintext = enc.encode(JSON.stringify(value));
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext
  );

  return {
    ciphertext: base64urlEncode(ciphertextBuffer),
    iv: base64urlEncode(iv.buffer as ArrayBuffer),
    salt: base64urlEncode(salt.buffer as ArrayBuffer),
  };
}

// ─── Decrypt ─────────────────────────────────────────────────────────────────

/**
 * Decrypts an EncryptedPayload with the provided passphrase.
 * Throws if the passphrase is wrong or the payload is corrupted.
 *
 * @param payload    - The encrypted payload from Supabase
 * @param passphrase - The user's private passphrase (stays on-device)
 */
export async function decrypt<T = unknown>(
  payload: EncryptedPayload,
  passphrase: string
): Promise<T> {
  const salt = base64urlDecode(payload.salt) as Uint8Array<ArrayBuffer>;
  const iv = base64urlDecode(payload.iv) as Uint8Array<ArrayBuffer>;
  const ciphertext = base64urlDecode(payload.ciphertext) as Uint8Array<ArrayBuffer>;

  const key = await deriveKey(passphrase, salt);

  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return JSON.parse(dec.decode(plaintextBuffer)) as T;
}

// ─── Session-key cache (sessionStorage) ──────────────────────────────────────

const SESSION_KEY_ENTRY = "sakan_session_passphrase";

/**
 * Stores the passphrase in sessionStorage for the duration of the browser tab.
 * It is cleared automatically when the tab is closed.
 * NEVER stored in localStorage, cookies, or any server-side mechanism.
 */
export function cachePassphrase(passphrase: string): void {
  try {
    sessionStorage.setItem(SESSION_KEY_ENTRY, passphrase);
  } catch {
    // sessionStorage unavailable (private browsing with blocked storage, etc.)
    // Silently ignore — the user will need to re-enter their passphrase.
  }
}

/** Retrieves the cached passphrase from sessionStorage, or null if absent. */
export function getCachedPassphrase(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY_ENTRY);
  } catch {
    return null;
  }
}

/** Clears the cached passphrase (e.g. on explicit logout). */
export function clearPassphrase(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY_ENTRY);
  } catch {
    // ignore
  }
}
