import { describe, expect, it } from "vitest";
import { isResearchRunning } from "./store";

describe("menu lookups in the background", () => {
  const now = new Date("2026-09-23T18:00:00Z");
  it("counts a lookup as running until it's clearly dead", () => {
    expect(isResearchRunning({ researchStartedAt: new Date("2026-09-23T17:58:00Z") }, now)).toBe(true);
    expect(isResearchRunning({ researchStartedAt: new Date("2026-09-23T17:50:00Z") }, now)).toBe(false);
    expect(isResearchRunning({ researchStartedAt: null }, now)).toBe(false);
  });
});
