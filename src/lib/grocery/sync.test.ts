import { describe, expect, it } from "vitest";
import type { GrocerySnapshot } from "./store";
import { applyOp } from "./sync";

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
