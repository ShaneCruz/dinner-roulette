"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { GroceryOp, GrocerySnapshot } from "./store";

/**
 * Keeps a grocery list in sync across phones, and working without signal.
 *
 * Every change is applied on screen immediately and queued in localStorage.
 * The queue is sent whenever there's a connection; meanwhile the server copy
 * is refreshed every few seconds so a second shopper's check-offs show up.
 * What you see is always "latest server copy + your unsent changes".
 */

const POLL_MS = 4000;

type Listener = () => void;

function createQueue(key: string) {
  let cache: GroceryOp[] | null = null;
  const listeners = new Set<Listener>();

  const read = (): GroceryOp[] => {
    if (cache) return cache;
    try {
      cache = JSON.parse(localStorage.getItem(key) ?? "[]") as GroceryOp[];
    } catch {
      cache = [];
    }
    return cache;
  };
  const write = (ops: GroceryOp[]) => {
    cache = ops;
    try {
      if (ops.length) localStorage.setItem(key, JSON.stringify(ops));
      else localStorage.removeItem(key);
    } catch {
      // Storage unavailable: changes still sync while online.
    }
    listeners.forEach((l) => l());
  };
  return {
    get: read,
    push: (op: GroceryOp) => write([...read(), op]),
    /** Drops the first `count` ops once the server has them. */
    shift: (count: number) => write(read().slice(count)),
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const queues = new Map<string, ReturnType<typeof createQueue>>();
function queueFor(weekPlanId: string) {
  let q = queues.get(weekPlanId);
  if (!q) {
    q = createQueue(`dinner-roulette:grocery-queue:${weekPlanId}`);
    queues.set(weekPlanId, q);
  }
  return q;
}

const EMPTY: GroceryOp[] = [];

export function applyOp(snapshot: GrocerySnapshot, op: GroceryOp, actingId: string | null): GrocerySnapshot {
  switch (op.op) {
    case "check":
      return {
        ...snapshot,
        items: snapshot.items.map((i) =>
          i.id === op.id ? { ...i, checked: op.checked, checkedByMemberId: op.checked ? actingId : null } : i,
        ),
      };
    case "add":
      if (snapshot.items.some((i) => i.id === op.id)) return snapshot;
      return {
        ...snapshot,
        items: [
          ...snapshot.items,
          {
            id: op.id,
            name: op.name,
            quantity: op.quantity,
            unit: op.unit,
            section: op.section,
            sources: [],
            isManual: true,
            isStaple: false,
            isStale: false,
            checked: false,
            checkedByMemberId: null,
          },
        ],
      };
    case "remove":
      return { ...snapshot, items: snapshot.items.filter((i) => i.id !== op.id) };
    case "claim": {
      const claims = snapshot.claims.filter((c) => c.section !== op.section);
      return {
        ...snapshot,
        claims: op.claim && actingId ? [...claims, { section: op.section, memberId: actingId }] : claims,
      };
    }
  }
}

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function useGrocerySync(weekPlanId: string, initial: GrocerySnapshot, actingId: string | null) {
  const queue = queueFor(weekPlanId);
  const pending = useSyncExternalStore(queue.subscribe, queue.get, () => EMPTY);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [server, setServer] = useState(initial);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const busy = useRef(false);
  const url = `/api/grocery/${weekPlanId}`;

  const sync = useCallback(async () => {
    if (busy.current || !navigator.onLine) return;
    busy.current = true;
    try {
      const ops = queue.get();
      const response = ops.length
        ? await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ops }),
          })
        : await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        // A bad op would otherwise block the queue forever.
        if (response.status === 400) queue.shift(ops.length);
        return;
      }
      const snapshot = (await response.json()) as GrocerySnapshot;
      if (ops.length) queue.shift(ops.length);
      setServer(snapshot);
      setLastSynced(Date.now());
    } catch {
      // Offline or flaky signal; try again on the next tick.
    } finally {
      busy.current = false;
    }
  }, [queue, url]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void sync();
    };
    const id = setInterval(tick, POLL_MS);
    window.addEventListener("online", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      window.removeEventListener("online", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [sync]);

  const change = useCallback(
    (op: GroceryOp) => {
      queue.push(op);
      void sync();
    },
    [queue, sync],
  );

  const snapshot = pending.reduce((s, op) => applyOp(s, op, actingId), server);
  return { snapshot, change, online, pendingCount: pending.length, lastSynced };
}

/** The first night an item is needed, or null for things you added yourself. */
export function neededBy(item: { sources: { date: string }[] }): string | null {
  const dates = item.sources.map((s) => s.date).sort();
  return dates[0] ?? null;
}

/**
 * The nights this item is still wanted for: ones that haven't happened and
 * haven't been cooked. A dinner already made needs no more shopping, whether
 * its night has passed or someone cooked it early.
 */
export function nightsStillAhead(
  item: { sources: { date: string }[] },
  today: string,
  cookedDates: string[] = [],
): string[] {
  return item.sources.map((s) => s.date).filter((date) => date >= today && !cookedDates.includes(date));
}

/**
 * Is this needed for a dinner between these nights? Asked of every night the
 * item belongs to, not just the first: an onion bought for Monday's chili and
 * Friday's roast still needs buying on Thursday, while one bought only for a
 * dinner already eaten does not.
 */
export function neededBetween(item: { sources: { date: string }[] }, from: string, to: string | null): boolean {
  // Things you added yourself have no night, so they're always on the list.
  if (!item.sources.length) return true;
  return item.sources.some((s) => s.date >= from && (!to || s.date <= to));
}
