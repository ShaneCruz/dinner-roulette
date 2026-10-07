import { describe, expect, it } from "vitest";
import { describeCandidates, describeConversation, type DinnerCandidate } from "./dinner-picks";

const base: DinnerCandidate = {
  id: "1",
  slug: "slow-cooker-chili",
  title: "Slow Cooker Chili",
  description: "A big pot of mild chili.",
  cuisine: "American",
  method: "slow_cooker",
  tags: ["make_ahead"],
  activeMinutes: 20,
  totalMinutes: 360,
  spiceLevel: 1,
  healthCategory: "comfort",
  lastCooked: null,
  plannedOn: null,
  familyStars: null,
  cooldownDays: 14,
};

describe("describeCandidates", () => {
  it("gives Claude the facts that decide tonight: method, time, history", () => {
    const line = describeCandidates([base], "2026-10-07");
    expect(line).toContain("slow-cooker-chili");
    expect(line).toContain("Slow cooker");
    expect(line).toContain("20 min hands-on, 360 min total");
    expect(line).toContain("never made");
  });

  it("flags dinners made too recently, and ones already on the plan", () => {
    const recent = describeCandidates([{ ...base, lastCooked: "2026-10-01", plannedOn: "2026-10-09", familyStars: 4.5 }], "2026-10-07");
    expect(recent).toContain("made 6 days ago (TOO RECENT)");
    expect(recent).toContain("already planned Fri, Oct 9");
    expect(recent).toContain("family rates it 4.5/5");

    const longAgo = describeCandidates([{ ...base, lastCooked: "2026-08-01" }], "2026-10-07");
    expect(longAgo).toContain("days ago");
    expect(longAgo).not.toContain("TOO RECENT");
  });
});

describe("describeConversation", () => {
  const titles = new Map([
    ["baked-ziti", "Baked Ziti"],
    ["chicken-alfredo", "Chicken Alfredo"],
  ]);

  it("is just the ask the first time", () => {
    expect(describeConversation([{ ask: "Something easy", shown: [] }], titles)).toBe("What tonight looks like: Something easy");
  });

  it("carries what was said and suggested into a follow-up", () => {
    const text = describeConversation(
      [
        { ask: "Something easy", shown: ["baked-ziti", "chicken-alfredo"] },
        { ask: "We've had a lot of pasta lately, something different", shown: [] },
      ],
      titles,
    );
    expect(text).toContain("They said: Something easy");
    expect(text).toContain("You suggested: Baked Ziti, Chicken Alfredo");
    expect(text).toContain("Their newest message: We've had a lot of pasta lately, something different");
  });
});
