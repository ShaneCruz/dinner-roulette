import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db";
import { familySettings, member, recipeProposal, weekPlan } from "@/db/schema";
import { mealNutrition, nutritionLine } from "@/lib/nutrition";
import { loadMeals, saveNight } from "@/lib/plan/store";
import { sendOnce } from "@/lib/push";
import { diffRecipes } from "@/lib/recipes/diff";
import { acceptProposal, isCritical, latestRevision, pendingProposal, undoLastChange } from "@/lib/recipes/proposals";
import { seedStarterRecipes } from "@/lib/recipes/seed";
import { getRecipe } from "@/lib/recipes/store";
import { runAutopilot } from "@/lib/suggest/autopilot";
import { createTestDatabase } from "@/test/db";
import { eq } from "drizzle-orm";

let db: Database;

beforeAll(async () => {
  db = await createTestDatabase();
  await db.insert(familySettings).values({ id: 1, familyName: "Test", setupCompletedAt: new Date() });
  await seedStarterRecipes(db);
  await db.insert(member).values([
    { name: "Mom", role: "parent" },
    { name: "Kid", role: "kid", spiceTolerance: 0 },
  ]);
});

describe("nutrition", () => {
  const n = (calories: number, proteinG: number) => ({ calories, proteinG, carbsG: 10, fiberG: 2, fatG: 5, sodiumMg: 300, note: null, estimatedAt: "" });
  it("adds up a main and its sides, and says when a side is unknown", () => {
    const meal = mealNutrition([n(500, 40), n(120, 3), null])!;
    expect(meal).toMatchObject({ calories: 620, proteinG: 43, carbsG: 20, fiberG: 4, complete: false });
    expect(nutritionLine(meal)).toBe("≈ 620 cal · 43g protein · 20g carbs · 4g fiber");
    expect(mealNutrition([null])).toBeNull();
  });
});

describe("autopilot", () => {
  // 2026-10-09 is a Friday; weeks start Sunday, so next week starts 2026-10-11.
  const base = { today: "2026-10-09", nowMinutes: 9 * 60 + 15, weekStartsOn: 0, autopilotDay: 5, enabled: true };

  it("waits for the right day and time", async () => {
    expect(await runAutopilot(db, { ...base, today: "2026-10-08" })).toBeNull();
    expect(await runAutopilot(db, { ...base, nowMinutes: 8 * 60 })).toBeNull();
    expect(await runAutopilot(db, { ...base, enabled: false })).toBeNull();
  });

  it("plans next week once, keeping dinners already picked", async () => {
    const soup = (await getRecipe(db, { slug: "chicken-noodle-soup" }))!;
    await saveNight(db, "2026-10-13", 0, { recipeId: soup.id });
    const result = (await runAutopilot(db, base))!;
    expect(result.weekStart).toBe("2026-10-11");
    expect(result.filled).toBe(6);
    expect(result.lines).toHaveLength(7);
    expect((await loadMeals(db, "2026-10-13", "2026-10-13")).get("2026-10-13")?.recipeId).toBe(soup.id);
    expect(await runAutopilot(db, { ...base, nowMinutes: 10 * 60 })).toBeNull();
    const [plan] = await db.select().from(weekPlan).where(eq(weekPlan.weekStart, "2026-10-11"));
    expect(plan.autopilotAt).not.toBeNull();
  });
});

describe("reminders go out once", () => {
  it("claims each reminder key a single time", async () => {
    expect(await sendOnce(db, "start:2026-10-12", [], { title: "t", body: "b", url: "/" })).toBe(true);
    expect(await sendOnce(db, "start:2026-10-12", [], { title: "t", body: "b", url: "/" })).toBe(false);
  });
});

describe("recipes that learn", () => {
  it("knows which ratings point to a problem", () => {
    expect(isCritical({ stars: 2, reasons: [], note: null })).toBe(true);
    expect(isCritical({ stars: 4, reasons: ["too_spicy"], note: null })).toBe(true);
    expect(isCritical({ stars: 3, reasons: [], note: "needed salt" })).toBe(true);
    expect(isCritical({ stars: 5, reasons: ["more_please"], note: "yum!" })).toBe(false);
  });

  it("accepts a tweak, shows what changed, and can undo it", async () => {
    const chili = (await getRecipe(db, { slug: "slow-cooker-chili" }))!;
    const proposed = {
      ...chili,
      baseServings: chili.baseServings + 2,
      ingredients: [
        ...chili.ingredients.filter((i) => i.name !== chili.ingredients[0].name),
        { name: "fire-roasted tomato", quantity: 2, unit: "can" as const, section: "pantry" as const, perishable: false },
      ],
    };
    const diff = diffRecipes(chili, proposed);
    expect(diff.facts[0]).toContain(`Serves ${chili.baseServings} → ${chili.baseServings + 2}`);
    expect(diff.ingredients.some((c) => c.type === "added" && c.name === "fire-roasted tomato")).toBe(true);
    expect(diff.ingredients.some((c) => c.type === "removed" && c.name === chili.ingredients[0].name)).toBe(true);

    const [p] = await db
      .insert(recipeProposal)
      .values({ recipeId: chili.id, trigger: "request", request: "more sauce", summary: "Saucier", proposed })
      .returning();
    expect((await pendingProposal(db, chili.id))?.id).toBe(p.id);
    expect(await acceptProposal(db, p.id)).toBe(chili.id);
    expect(await acceptProposal(db, p.id)).toBeNull();
    const after = (await getRecipe(db, { id: chili.id }))!;
    expect(after.baseServings).toBe(chili.baseServings + 2);
    expect(after.slug).toBe(chili.slug);
    expect(after.nutrition).toBeNull();
    expect((await latestRevision(db, chili.id))?.reason).toBe("Saucier");

    expect(await undoLastChange(db, chili.id)).toBe(true);
    const back = (await getRecipe(db, { id: chili.id }))!;
    expect(back.baseServings).toBe(chili.baseServings);
    expect(back.ingredients).toEqual(chili.ingredients);
    expect(await undoLastChange(db, chili.id)).toBe(false);
  });
});
