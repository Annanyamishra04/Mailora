"use client";

import * as React from "react";

export function useClipboard() {
  const [isCopying, setIsCopying] = React.useState(false);

  const copy = React.useCallback(async (text: string): Promise<boolean> => {
    if (!navigator.clipboard) return false;
    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    } finally {
      setIsCopying(false);
    }
  }, []);

  return { copy, isCopying };
}
