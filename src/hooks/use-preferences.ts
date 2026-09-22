"use client";

import * as React from "react";
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_CHANGED_EVENT,
  getPreferences,
  savePreferences,
} from "@/lib/storage/preferences";
import type { WritingPreferences } from "@/lib/types";

export function usePreferences() {
  const [preferences, setPreferences] =
    React.useState<WritingPreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = React.useState(false);

  const refresh = React.useCallback(() => {
    setPreferences(getPreferences());
    setIsLoaded(true);
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load from localStorage on mount, an external system
    refresh();
    window.addEventListener(PREFERENCES_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(PREFERENCES_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  const update = React.useCallback(
    (patch: Partial<WritingPreferences>) => {
      const next = savePreferences(patch);
      setPreferences(next);
      return next;
    },
    [],
  );

  return { preferences, isLoaded, update };
}
