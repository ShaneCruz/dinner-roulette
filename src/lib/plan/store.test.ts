import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db";
import { groceryItem, member, memberAvailability, memberFoodRule } from "@/db/schema";
import { seedStarterRecipes } from "@/lib/recipes/seed";
import { getRecipe } from "@/lib/recipes/store";
import { createTestDatabase } from "@/test/db";
import {
  eatersFor,
  getOrCreateWeekPlan,
  listBumped,
  listGroceryItems,
  loadEaterContext,
  loadMeals,
  placeBumped,
  regenerateGroceryList,
  saveNight,
  skipNight,
  swapNights,
} from "./store";

let db: Database;
let tacosId: string;
let chiliId: string;
let riceId: string;
let boarderId: string;

const SUNDAY = 0;

beforeAll(async () => {
  db = await createTestDatabase();
  await seedStarterRecipes(db, ["taco-night", "slow-cooker-chili", "steamed-rice"]);
  tacosId = (await getRecipe(db, { slug: "taco-night" }))!.id;
  chiliId = (await getRecipe(db, { slug: "slow-cooker-chili" }))!.id;
  riceId = (await getRecipe(db, { slug: "steamed-rice" }))!.id;

  const [, , boarder] = await db
    .insert(member)
    .values([
      { name: "Parent", role: "parent", wantsHealthySwaps: true },
      { name: "Kid", role: "kid" },
      { name: "Boarder", role: "kid", defaultPresence: "away" },
    ])
    .returning();
  boarderId = boarder.id;
  await db.insert(memberFoodRule).values({ memberId: boarder.id, kind: "nope", ingredient: "ground beef" });
  await db.insert(memberAvailability).values({
    memberId: boarder.id,
    startDate: "2026-09-26",
    endDate: "2026-09-27",
    presence: "home",
    label: "Long weekend",
  });
});

describe("planning a week", () => {
  it("works out who's home each night", async () => {
    const context = await loadEaterContext(db, "2026-09-20", "2026-09-26");
    expect(eatersFor(context, "2026-09-21", null).map((m) => m.name)).toEqual(["Parent", "Kid"]);
    expect(eatersFor(context, "2026-09-26", null)).toHaveLength(3);
    expect(eatersFor(context, "2026-09-21", [boarderId]).map((m) => m.name)).toEqual(["Boarder"]);
  });

  it("saves nights into the right week and builds groceries", async () => {
    const planId = await saveNight(db, "2026-09-21", SUNDAY, { recipeId: tacosId, sideRecipeIds: [riceId] });
    await saveNight(db, "2026-09-26", SUNDAY, { recipeId: chiliId, timeBudget: "hands_off" });
    await regenerateGroceryList(db, planId);

    const items = await listGroceryItems(db, planId);
    const beef = items.find((i) => i.name === "ground beef")!;
    expect(beef.sources.map((s) => s.recipeTitle).sort()).toEqual(
      ["Slow Cooker Chili", "Taco Night"].sort(),
    );
    // Rice (a side) is on the list too
    expect(items.some((i) => i.sources.some((s) => s.recipeTitle.includes("Rice")))).toBe(true);
  });

  it("buys the boarder's protein swap only on nights they're home", async () => {
    const planId = (await getOrCreateWeekPlan(db, "2026-09-20")).id;
    await regenerateGroceryList(db, planId);
    const chili = (await getRecipe(db, { id: chiliId }))!;
    const swap = chili.variants.find((v) => v.avoids.includes("ground beef"))!;
    const swapItem = swap.adds[0].name;
    const items = await listGroceryItems(db, planId);
    // Chili is on Saturday, when the boarder is home
    expect(items.find((i) => i.name === swapItem)).toBeDefined();
  });

  it("keeps checked items that are no longer needed, and drops unchecked ones", async () => {
    const planId = (await getOrCreateWeekPlan(db, "2026-09-20")).id;
    const items = await listGroceryItems(db, planId);
    const tacoOnly = items.filter(
      (i) => i.sources.length === 1 && i.sources[0].recipeTitle === "Taco Night",
    );
    expect(tacoOnly.length).toBeGreaterThan(1);
    const [checked, unchecked] = tacoOnly;
    await db.update(groceryItem).set({ checked: true }).where(eq(groceryItem.id, checked.id));

    await skipNight(db, "2026-09-21", SUNDAY, true);
    await regenerateGroceryList(db, planId);

    const after = await listGroceryItems(db, planId);
    expect(after.find((i) => i.id === checked.id)?.isStale).toBe(true);
    expect(after.find((i) => i.id === unchecked.id)).toBeUndefined();
  });

  it("puts skipped dinners in the bumped tray and back on a later night", async () => {
    const bumped = await listBumped(db);
    expect(bumped.map((b) => b.title)).toEqual(["Taco Night"]);
    await placeBumped(db, bumped[0].id, "2026-09-24", SUNDAY);
    expect(await listBumped(db)).toHaveLength(0);
    const meals = await loadMeals(db, "2026-09-24", "2026-09-24");
    expect(meals.get("2026-09-24")?.recipeId).toBe(tacosId);
  });

  it("swaps dinners but not the nights' settings", async () => {
    await swapNights(db, "2026-09-24", "2026-09-26", SUNDAY);
    const meals = await loadMeals(db, "2026-09-24", "2026-09-26");
    expect(meals.get("2026-09-24")?.recipeId).toBe(chiliId);
    expect(meals.get("2026-09-26")?.recipeId).toBe(tacosId);
    expect(meals.get("2026-09-26")?.timeBudget).toBe("hands_off");
  });
});
