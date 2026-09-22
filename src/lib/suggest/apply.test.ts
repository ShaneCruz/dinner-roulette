import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db";
import { familySettings, member, memberAvailability, memberFoodRule } from "@/db/schema";
import { listGroceryItems, loadMeals, getOrCreateWeekPlan, saveNight } from "@/lib/plan/store";
import { saveRatings, averageRatings, mealsNeedingRatings } from "@/lib/ratings/store";
import { seedStarterRecipes } from "@/lib/recipes/seed";
import { getRecipe } from "@/lib/recipes/store";
import { createTestDatabase } from "@/test/db";
import { seededRandom } from "./engine";
import { applySuggestions } from "./apply";
import { loadEngineInputs } from "./load";

let db: Database;
let ids: Record<string, string> = {};
const WEEK = "2026-10-11"; // a Sunday
const TODAY = "2026-10-11";

beforeAll(async () => {
  db = await createTestDatabase();
  await db.insert(familySettings).values({ id: 1, familyName: "Test", setupCompletedAt: new Date() });
  await seedStarterRecipes(db);
  const rows = await db
    .insert(member)
    .values([
      { name: "Dad", role: "parent", spiceTolerance: 3 },
      { name: "Mom", role: "parent", spiceTolerance: 1 },
      { name: "Teen", role: "kid", defaultPresence: "away" },
      { name: "Tween", role: "kid", spiceTolerance: 0 },
      { name: "Kid", role: "kid", spiceTolerance: 2 },
    ])
    .returning();
  ids = Object.fromEntries(rows.map((r) => [r.name, r.id]));
  await db.insert(memberFoodRule).values({ memberId: ids.Teen, kind: "nope", ingredient: "ground beef" });
  await db.insert(memberAvailability).values({
    memberId: ids.Teen,
    startDate: "2026-10-16",
    endDate: "2026-10-19",
    presence: "home",
    label: "Long weekend",
  });
});

describe("applySuggestions", () => {
  it("fills the open nights and leaves the others alone", async () => {
    await saveNight(db, "2026-10-12", 0, { nightType: "takeout" });
    const tacos = (await getRecipe(db, { slug: "taco-night" }))!;
    await saveNight(db, "2026-10-13", 0, { recipeId: tacos.id });

    const filled = await applySuggestions(db, WEEK, TODAY, 0, { random: seededRandom(5), weather: false });
    expect(filled).toBe(5);

    const meals = await loadMeals(db, "2026-10-11", "2026-10-17");
    expect(meals.get("2026-10-12")?.nightType).toBe("takeout");
    expect(meals.get("2026-10-13")?.recipeId).toBe(tacos.id);
    const suggested = [...meals.values()].filter((m) => m.suggestionReason);
    expect(suggested).toHaveLength(5);
    expect(new Set(suggested.map((m) => m.recipeId)).size).toBe(5);
    expect(suggested.every((m) => m.favoredMemberId)).toBe(true);

    // Groceries were rebuilt
    const plan = await getOrCreateWeekPlan(db, WEEK);
    expect((await listGroceryItems(db, plan.id)).length).toBeGreaterThan(10);
  });

  it("gives the boarder First Pick on their first night home", async () => {
    const meals = await loadMeals(db, "2026-10-16", "2026-10-16");
    const friday = meals.get("2026-10-16")!;
    expect(friday.favoredMemberId).toBe(ids.Teen);
    expect(friday.suggestionReason).toContain("First pick");
  });

  it("re-rolls a single night with a different dinner", async () => {
    const before = (await loadMeals(db, "2026-10-14", "2026-10-14")).get("2026-10-14")!;
    await applySuggestions(db, WEEK, TODAY, 0, { onlyDate: "2026-10-14", random: seededRandom(9), weather: false });
    const after = (await loadMeals(db, "2026-10-14", "2026-10-14")).get("2026-10-14")!;
    expect(after.recipeId).not.toBe(before.recipeId);
  });
});

describe("ratings", () => {
  it("feed back into the engine, and track who still needs to rate", async () => {
    const tacos = (await getRecipe(db, { slug: "taco-night" }))!;
    const meal = (await loadMeals(db, "2026-10-13", "2026-10-13")).get("2026-10-13")!;
    await saveNight(db, "2026-10-13", 0, { status: "cooked" });

    let pending = await mealsNeedingRatings(db, "2026-10-12", "2026-10-14");
    expect(pending).toHaveLength(1);
    expect(pending[0].ratedMemberIds).toEqual([]);

    await saveRatings(
      db,
      { id: meal.id, recipeId: tacos.id },
      [
        { memberId: ids.Kid, stars: 5, reasons: ["more_please"], note: null },
        { memberId: ids.Tween, stars: 2, reasons: ["too_spicy"], note: "the salsa" },
      ],
      ids.Mom,
    );
    pending = await mealsNeedingRatings(db, "2026-10-12", "2026-10-14");
    expect(pending[0].ratedMemberIds.sort()).toEqual([ids.Kid, ids.Tween].sort());

    const averages = await averageRatings(db);
    expect(averages.get(ids.Kid)?.[tacos.id]).toBe(5);

    const { context } = await loadEngineInputs(db, "2026-10-18", { weather: false });
    expect(context.members.find((m) => m.id === ids.Kid)?.ratings[tacos.id]).toBe(5);
    // Cooked last week counts for cooldowns next week
    expect(context.recipes.find((r) => r.id === tacos.id)?.lastCooked).toBe("2026-10-13");
  });
});
