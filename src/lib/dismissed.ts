"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Remembers that someone dismissed a hint on this device. Kept in
 * localStorage, which can be unavailable (private windows, blocked site
 * data), so everything falls back to "not dismissed".
 */

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function useDismissed(key: string): [boolean, () => void] {
  const dismissed = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => false,
  );
  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      // Fine: the hint shows again next time.
    }
    listeners.forEach((listener) => listener());
  }, [key]);
  return [dismissed, dismiss];
}

/** Remembers a small choice (a tab, a filter) on this device. */
export function useStoredChoice<T extends string>(key: string, fallback: T, allowed: readonly T[]): [T, (value: T) => void] {
  const stored = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const choose = useCallback(
    (value: T) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        // Fine: it just won't be remembered.
      }
      listeners.forEach((listener) => listener());
    },
    [key],
  );
  return [allowed.includes(stored as T) ? (stored as T) : fallback, choose];
}
