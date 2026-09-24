import { describe, expect, it } from "vitest";
import type { GrocerySnapshot } from "./store";
import { applyOp, neededBetween } from "./sync";

const snapshot: GrocerySnapshot = {
  items: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      name: "lemon",
      quantity: 2,
      unit: "whole",
      section: "produce",
      sources: [],
      isManual: false,
      isStaple: false,
      isStale: false,
      checked: false,
      checkedByMemberId: null,
    },
  ],
  claims: [],
};

describe("applyOp", () => {
  it("checks items and records who checked them", () => {
    const next = applyOp(snapshot, { op: "check", id: snapshot.items[0].id, checked: true }, "me");
    expect(next.items[0]).toMatchObject({ checked: true, checkedByMemberId: "me" });
  });

  it("adds manual items once, even if replayed", () => {
    const add = {
      op: "add" as const,
      id: "00000000-0000-4000-8000-000000000002",
      name: "milk",
      quantity: null,
      unit: "whole" as const,
      section: "dairy" as const,
    };
    const once = applyOp(snapshot, add, "me");
    expect(applyOp(once, add, "me").items).toHaveLength(2);
  });

  it("claims and releases sections", () => {
    const claimed = applyOp(snapshot, { op: "claim", section: "produce", claim: true }, "me");
    expect(claimed.claims).toEqual([{ section: "produce", memberId: "me" }]);
    expect(applyOp(claimed, { op: "claim", section: "produce", claim: false }, "me").claims).toEqual([]);
  });
});

describe("what still needs buying", () => {
  const item = (...dates: string[]) => ({ sources: dates.map((date) => ({ date })) });
  // Wednesday. Monday's chili is eaten; Thursday and Friday are still to come.
  const today = "2026-09-23";
  const friday = "2026-09-25";

  it("drops a dinner that's already been made", () => {
    expect(neededBetween(item("2026-09-21"), today, friday)).toBe(false);
  });

  it("keeps something the rest of the week still needs", () => {
    expect(neededBetween(item("2026-09-24"), today, friday)).toBe(true);
    expect(neededBetween(item(today), today, friday)).toBe(true);
  });

  it("keeps an ingredient shared with a dinner already made", () => {
    // One onion for Monday's chili and Friday's roast: Friday still needs it.
    expect(neededBetween(item("2026-09-21", friday), today, friday)).toBe(true);
  });

  it("leaves out what's needed after the window", () => {
    expect(neededBetween(item("2026-09-26"), today, friday)).toBe(false);
    expect(neededBetween(item("2026-09-26"), today, null)).toBe(true);
  });

  it("always keeps what you added yourself", () => {
    expect(neededBetween(item(), today, friday)).toBe(true);
  });
});
