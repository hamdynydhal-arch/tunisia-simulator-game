import type { StateStorage } from "zustand/middleware";

/**
 * Tamper-resistant localStorage wrapper for the persisted campaign.
 *
 * The payload is Base64-encoded and stamped with an FNV-1a checksum over a
 * salted copy of the bytes. On read, the checksum is recomputed and compared;
 * any manual edit of the localStorage JSON (e.g. inflating the budget) changes
 * the payload but not a matching checksum, so verification fails and we return
 * `null` — Zustand then falls back to the default (clean) state.
 *
 * This is a client-side anti-cheat deterrent, not a cryptographic trust
 * boundary: the salt ships in the bundle, so a determined user could recompute
 * it. It defeats casual save editing, which is the goal.
 */
const INTEGRITY_SALT = "tunisia-simulator::integrity::v1";

function checksum(input: string): string {
  let hash = 0x811c9dc5;
  const salted = INTEGRITY_SALT + input;
  for (let i = 0; i < salted.length; i++) {
    hash ^= salted.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

const encodeBase64 = (value: string) =>
  btoa(unescape(encodeURIComponent(value)));
const decodeBase64 = (value: string) =>
  decodeURIComponent(escape(atob(value)));

interface Envelope {
  /** Base64-encoded persisted payload. */
  p: string;
  /** Checksum of the payload. */
  c: string;
}

export const checksummedStorage: StateStorage = {
  getItem: (name) => {
    try {
      const raw = localStorage.getItem(name);
      if (!raw) {
        return null;
      }
      const envelope = JSON.parse(raw) as Partial<Envelope>;
      if (
        !envelope ||
        typeof envelope.p !== "string" ||
        envelope.c !== checksum(envelope.p)
      ) {
        return null; // corrupted or tampered → force a clean reset
      }
      return decodeBase64(envelope.p);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    const payload = encodeBase64(value);
    const envelope: Envelope = { p: payload, c: checksum(payload) };
    localStorage.setItem(name, JSON.stringify(envelope));
  },
  removeItem: (name) => localStorage.removeItem(name),
};
