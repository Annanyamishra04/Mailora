"use client";

import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { getEmailStore, signedOutEmailStore, EMAILS_CHANGED_EVENT } from "@/lib/storage";
import type { NewSavedEmail, SavedEmail } from "@/lib/types";

/**
 * Reactive wrapper around `lib/storage`. Keeps a React-state mirror of
 * whatever the active store returns. Which store is "active" follows auth
 * state from `useAuth`:
 *
 *   - signed in                        → Supabase, through `/api/emails`
 *   - Supabase not configured (dev)    → this browser's local storage
 *   - configured but signed out        → `signedOutEmailStore`, which fails
 *     loudly rather than quietly saving to localStorage while the UI claims
 *     the work is safe (see `lib/storage/index.ts`)
 *
 * After a write, the server's response is merged into local state directly
 * instead of re-fetching the whole list — autosave writes every few
 * seconds, and a full list GET per write was wasted work. A `refresh()`
 * still runs on mount, on the "Try again" button, and for local-storage
 * change events. Refresh responses that arrive out of order are discarded.
 * This is the hook components should use instead of calling `lib/storage`
 * directly.
 */
export function useEmails() {
  const { user, isLoading: authLoading, isConfigured } = useAuth();
  const isAuthenticated = Boolean(user);
  const usesLocalStorage = !isAuthenticated && !isConfigured;
  const store = React.useMemo(
    () => (isAuthenticated || usesLocalStorage ? getEmailStore(isAuthenticated) : signedOutEmailStore),
    [isAuthenticated, usesLocalStorage],
  );

  const [emails, setEmails] = React.useState<SavedEmail[]>([]);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Monotonic id of the newest refresh; older responses are ignored so a
  // slow early GET can't overwrite a newer result (or a fresher local write).
  const refreshSeq = React.useRef(0);

  const refresh = React.useCallback(() => {
    if (authLoading) return;
    const seq = ++refreshSeq.current;
    store
      .getEmails()
      .then((result) => {
        if (seq !== refreshSeq.current) return;
        setEmails(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (seq !== refreshSeq.current) return;
        setError(err instanceof Error ? err.message : "Couldn't load your saved emails.");
      })
      .finally(() => {
        if (seq === refreshSeq.current) setIsLoaded(true);
      });
  }, [store, authLoading]);

  const upsertLocal = React.useCallback((email: SavedEmail) => {
    // Supersede any refresh still in flight: its snapshot predates this write.
    refreshSeq.current += 1;
    setEmails((current) =>
      current.some((existing) => existing.id === email.id)
        ? current.map((existing) => (existing.id === email.id ? email : existing))
        : [email, ...current],
    );
  }, []);

  React.useEffect(() => {
    refresh();

    // Local storage changes (Phase 1 behavior) can come from another tab;
    // Supabase changes only happen through this app's own mutations, which
    // merge their result into state directly (see `upsertLocal`).
    if (usesLocalStorage) {
      window.addEventListener(EMAILS_CHANGED_EVENT, refresh);
      window.addEventListener("storage", refresh);
      return () => {
        window.removeEventListener(EMAILS_CHANGED_EVENT, refresh);
        window.removeEventListener("storage", refresh);
      };
    }
  }, [refresh, usesLocalStorage]);

  const saveEmail = React.useCallback(
    async (input: NewSavedEmail) => {
      const saved = await store.saveEmail(input);
      upsertLocal(saved);
      return saved;
    },
    [store, upsertLocal],
  );

  const updateEmail = React.useCallback(
    async (id: string, patch: Partial<NewSavedEmail>) => {
      const updated = await store.updateEmail(id, patch);
      if (updated) upsertLocal(updated);
      return updated;
    },
    [store, upsertLocal],
  );

  const deleteEmail = React.useCallback(
    async (id: string) => {
      await store.deleteEmail(id);
      refreshSeq.current += 1;
      setEmails((current) => current.filter((email) => email.id !== id));
    },
    [store],
  );

  const toggleFavorite = React.useCallback(
    async (id: string) => {
      const current = emails.find((email) => email.id === id);
      if (!current) return undefined;
      const updated = await store.updateEmail(id, { favorite: !current.favorite });
      if (updated) upsertLocal(updated);
      return updated;
    },
    [store, upsertLocal, emails],
  );

  return {
    emails,
    isLoaded,
    error,
    saveEmail,
    updateEmail,
    deleteEmail,
    toggleFavorite,
    refresh,
  };
}
