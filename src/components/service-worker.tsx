"use client";

import { useEffect } from "react";

/** Registers /sw.js in production so the grocery list opens without signal. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Not fatal: everything works online without it.
    });
  }, []);
  return null;
}
