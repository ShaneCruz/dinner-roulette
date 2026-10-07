import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db";
import { member } from "@/db/schema";
import { createTestDatabase } from "@/test/db";
import {
  addCookPhoto,
  cookingStats,
  deleteCookPhoto,
  dishesFrom,
  madeDinners,
  latestCookPhotos,
  listCookPhotos,
  loadHighlights,
  promoteCookPhoto,
  recentPlannedNight,
  redateCookPhoto,
} from "./cook-photos";
import { loadMeals } from "@/lib/plan/store";
import { rating } from "@/db/schema";
import { makeLabel, ordinal } from "@/app/(app)/highlights/slideshow";
import { saveNight } from "@/lib/plan/store";
import { seedStarterRecipes } from "./seed";
import { getRecipe, getRecipePhoto } from "./store";

let db: Database;
let tacosId: string;
let riceId: string;
let momId: string;

beforeAll(async () => {
  db = await createTestDatabase();
  await seedStarterRecipes(db, ["taco-night", "steamed-rice"]);
  tacosId = (await getRecipe(db, { slug: "taco-night" }))!.id;
  riceId = (await getRecipe(db, { slug: "steamed-rice" }))!.id;
  [{ id: momId }] = await db.insert(member).values({ name: "Mom", role: "parent" }).returning({ id: member.id });
});

const photo = (madeOn: string, data: string) => ({
  recipeId: tacosId,
  plannedMealId: null,
  memberId: momId,
  madeOn,
  contentType: "image/jpeg",
  data,
});

describe("photos of the dish as made", () => {
  it("keeps a dated log, newest first, with who took each", async () => {
    await addCookPhoto(db, photo("2026-09-01", "AAA"));
    await addCookPhoto(db, photo("2026-10-06", "BBB"));
    const makes = await listCookPhotos(db, tacosId);
    expect(makes.map((m) => m.madeOn)).toEqual(["2026-10-06", "2026-09-01"]);
    expect(makes[0].who).toBe("Mom");
  });

  it("finds the latest make of each recipe, and none for recipes never photographed", async () => {
    const latest = await latestCookPhotos(db, [tacosId, riceId]);
    expect(latest.get(tacosId)?.madeOn).toBe("2026-10-06");
    expect(latest.has(riceId)).toBe(false);
  });

  it("never touches the main picture unless asked, and keeps the make when promoted", async () => {
    expect((await getRecipe(db, { id: tacosId }))!.photoAt).toBeNull();
    const [latest] = await listCookPhotos(db, tacosId);
    await promoteCookPhoto(db, latest.id);
    expect((await getRecipe(db, { id: tacosId }))!.photoAt).not.toBeNull();
    expect((await getRecipePhoto(db, tacosId))?.data).toBe("BBB");
    expect(await listCookPhotos(db, tacosId)).toHaveLength(2);
  });

  it("removes one photo without touching the rest", async () => {
    const [latest] = await listCookPhotos(db, tacosId);
    await deleteCookPhoto(db, latest.id);
    expect((await listCookPhotos(db, tacosId)).map((m) => m.madeOn)).toEqual(["2026-09-01"]);
    // The promoted copy stays as the main picture
    expect((await getRecipePhoto(db, tacosId))?.data).toBe("BBB");
  });
});

describe("dating a photo taken after the fact", () => {
  it("finds the night the dish was last on the plan", async () => {
    await saveNight(db, "2026-10-05", 0, { recipeId: tacosId });
    await saveNight(db, "2026-10-06", 0, { recipeId: riceId });
    expect((await recentPlannedNight(db, tacosId, "2026-10-07"))?.date).toBe("2026-10-05");
    // Too long ago, or not yet, doesn't count
    expect(await recentPlannedNight(db, tacosId, "2026-11-01")).toBeNull();
    expect(await recentPlannedNight(db, tacosId, "2026-10-04")).toBeNull();
  });

  it("moves a photo to the night it was really made, and links that dinner", async () => {
    const id = await addCookPhoto(db, photo("2026-10-07", "CCC"));
    await redateCookPhoto(db, id, "2026-10-05");
    const moved = (await listCookPhotos(db, tacosId)).find((m) => m.id === id)!;
    expect(moved.madeOn).toBe("2026-10-05");
  });
});

describe("Chef Highlights", () => {
  it("counts which make each photo was, and carries the family's rating for that night", async () => {
    await saveNight(db, "2026-09-01", 0, { recipeId: tacosId, status: "cooked" });
    await saveNight(db, "2026-10-05", 0, { status: "cooked" });
    const night = (await loadMeals(db, "2026-10-05", "2026-10-05")).get("2026-10-05")!;
    await db.insert(rating).values([
      { plannedMealId: night.id, recipeId: tacosId, memberId: momId, stars: 5 },
    ]);
    const highlights = await loadHighlights(db);
    const october = highlights.find((h) => h.madeOn === "2026-10-05")!;
    const september = highlights.find((h) => h.madeOn === "2026-09-01")!;
    expect(highlights[0].madeOn >= highlights[highlights.length - 1].madeOn).toBe(true);
    expect(september.makeNumber).toBe(1);
    expect(october.makeNumber).toBe(2);
    expect(october.stars).toBe(5);
    expect(october.title).toBe("Taco Night");
  });

  it("adds up dinners cooked and different dishes", async () => {
    const stats = cookingStats(await madeDinners(db));
    expect(stats.dinners).toBe(2);
    expect(stats.dishes).toBe(1);
    expect(stats.firstTries).toBe(1);
    expect(stats.since).toBe("2026-09-01");
    expect(stats.photos).toBeGreaterThan(0);
  });

  it("counts a dinner that was photographed but never marked made", async () => {
    await addCookPhoto(db, { ...photo("2026-10-06", "DDD"), recipeId: riceId });
    const stats = cookingStats(await madeDinners(db));
    expect(stats.dinners).toBe(3);
    expect(stats.dishes).toBe(2);
    const rice = (await loadHighlights(db)).find((h) => h.madeOn === "2026-10-06")!;
    expect(rice.makeNumber).toBe(1);
  });

  it("lists the dinners behind the numbers, with what's missing a photo and when to date one", async () => {
    await saveNight(db, "2026-10-08", 0, { recipeId: tacosId, status: "cooked" });
    const dinners = await madeDinners(db);
    expect(dinners.map((d) => d.date)).toEqual(["2026-10-08", "2026-10-06", "2026-10-05", "2026-09-01"]);
    const unphotographed = dinners[0];
    expect(unphotographed.photoIds).toEqual([]);
    expect(unphotographed.mealId).not.toBeNull();
    expect(dinners.filter((d) => d.firstTime).map((d) => d.date).sort()).toEqual(["2026-09-01", "2026-10-06"]);

    const [tacos, rice] = dishesFrom(dinners);
    expect(tacos).toMatchObject({ title: "Taco Night", times: 3, firstDate: "2026-09-01", lastDate: "2026-10-08" });
    expect(tacos.photos).toBeGreaterThan(0);
    expect(rice).toMatchObject({ times: 1, photos: 1 });
  });

  it("says first time, 2nd, 3rd, 11th", () => {
    expect(makeLabel(1)).toBe("🎉 First time making it!");
    expect(makeLabel(null)).toBeNull();
    expect([2, 3, 4, 11, 12, 21, 22, 103].map(ordinal)).toEqual(["2nd", "3rd", "4th", "11th", "12th", "21st", "22nd", "103rd"]);
  });
});
