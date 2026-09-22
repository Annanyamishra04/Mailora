"use client";

import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { getTemplateStore, signedOutTemplateStore, TEMPLATES_CHANGED_EVENT } from "@/lib/storage";
import { BUILTIN_TEMPLATES } from "@/lib/templates/builtin";
import type { EmailTemplate, NewEmailTemplate } from "@/lib/types";

/**
 * Reactive wrapper around `lib/storage`'s template store, combined with the
 * static built-in templates. Which custom-template store is "active"
 * follows auth state from `useAuth`, exactly like `useEmails`.
 *
 * Built-in templates are always present regardless of auth state — they're
 * not user data, just starter content — and always sort before custom ones.
 */
export function useTemplates() {
  const { user, isLoading: authLoading, isConfigured } = useAuth();
  const isAuthenticated = Boolean(user);
  const usesLocalStorage = !isAuthenticated && !isConfigured;
  const store = React.useMemo(
    () =>
      isAuthenticated || usesLocalStorage
        ? getTemplateStore(isAuthenticated)
        : signedOutTemplateStore,
    [isAuthenticated, usesLocalStorage],
  );

  const [customTemplates, setCustomTemplates] = React.useState<EmailTemplate[]>([]);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Newest-refresh-wins guard; see `useEmails` for why.
  const refreshSeq = React.useRef(0);

  const refresh = React.useCallback(() => {
    if (authLoading) return;
    const seq = ++refreshSeq.current;
    store
      .getTemplates()
      .then((result) => {
        if (seq !== refreshSeq.current) return;
        setCustomTemplates(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (seq !== refreshSeq.current) return;
        setError(err instanceof Error ? err.message : "Couldn't load your templates.");
      })
      .finally(() => {
        if (seq === refreshSeq.current) setIsLoaded(true);
      });
  }, [store, authLoading]);

  const upsertLocal = React.useCallback((template: EmailTemplate) => {
    refreshSeq.current += 1;
    setCustomTemplates((current) =>
      current.some((existing) => existing.id === template.id)
        ? current.map((existing) => (existing.id === template.id ? template : existing))
        : [template, ...current],
    );
  }, []);

  React.useEffect(() => {
    refresh();

    if (usesLocalStorage) {
      window.addEventListener(TEMPLATES_CHANGED_EVENT, refresh);
      window.addEventListener("storage", refresh);
      return () => {
        window.removeEventListener(TEMPLATES_CHANGED_EVENT, refresh);
        window.removeEventListener("storage", refresh);
      };
    }
  }, [refresh, usesLocalStorage]);

  const templates = React.useMemo(
    () => [...BUILTIN_TEMPLATES, ...customTemplates],
    [customTemplates],
  );

  const saveTemplate = React.useCallback(
    async (input: NewEmailTemplate) => {
      const saved = await store.saveTemplate(input);
      upsertLocal(saved);
      return saved;
    },
    [store, upsertLocal],
  );

  const updateTemplate = React.useCallback(
    async (id: string, patch: Partial<NewEmailTemplate>) => {
      const updated = await store.updateTemplate(id, patch);
      if (updated) upsertLocal(updated);
      return updated;
    },
    [store, upsertLocal],
  );

  const deleteTemplate = React.useCallback(
    async (id: string) => {
      await store.deleteTemplate(id);
      refreshSeq.current += 1;
      setCustomTemplates((current) => current.filter((template) => template.id !== id));
    },
    [store],
  );

  return {
    templates,
    customTemplates,
    isLoaded,
    error,
    saveTemplate,
    updateTemplate,
    deleteTemplate,
    refresh,
  };
}
