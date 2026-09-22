import type { WritingPreferences } from "@/lib/types";

/**
 * Frontend-only preferences (default tone/length, sign-off behavior).
 * Explicitly separate from anything that requires an account: this data
 * lives per-browser until real user settings exist behind auth.
 */

const STORAGE_KEY = "ai-mail-studio:preferences";
export const PREFERENCES_CHANGED_EVENT = "ai-mail-studio:preferences-changed";

export const DEFAULT_PREFERENCES: WritingPreferences = {
  defaultTone: "professional",
  defaultLength: "medium",
  autoSignOff: true,
  signatureName: "",
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function getPreferences(): WritingPreferences {
  if (!isBrowser()) return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(
  patch: Partial<WritingPreferences>,
): WritingPreferences {
  const next = { ...getPreferences(), ...patch };
  if (isBrowser()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(PREFERENCES_CHANGED_EVENT));
    } catch {
      throw new Error("Couldn't save preferences to this browser's storage.");
    }
  }
  return next;
}
