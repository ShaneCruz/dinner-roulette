import { describe, expect, it } from "vitest";
import { costCents, midnightIn } from "./usage";

describe("AI costs", () => {
  it("prices Opus and Haiku calls from their tokens", () => {
    // 10k in + 2k out on Opus: $0.05 + $0.05 = 10 cents
    expect(costCents("claude-opus-5", { input_tokens: 10_000, output_tokens: 2_000 })).toBeCloseTo(10);
    // Same call on Haiku is a fifth of that
    expect(costCents("claude-haiku-4-5", { input_tokens: 10_000, output_tokens: 2_000 })).toBeCloseTo(2);
  });

  it("adds web searches at a cent each", () => {
    expect(costCents("claude-opus-5", { input_tokens: 0, output_tokens: 0, server_tool_use: { web_search_requests: 3 } })).toBeCloseTo(3);
  });

  it("finds midnight in the family's time zone", () => {
    expect(midnightIn("2026-09-20", "America/Chicago").toISOString()).toBe("2026-09-20T05:00:00.000Z");
    expect(midnightIn("2026-12-20", "America/Chicago").toISOString()).toBe("2026-12-20T06:00:00.000Z");
  });
});
