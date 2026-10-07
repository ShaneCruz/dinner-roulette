import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db";
import { member } from "@/db/schema";
import { createTestDatabase } from "@/test/db";
import { addCookPhoto, deleteCookPhoto, latestCookPhotos, listCookPhotos, promoteCookPhoto } from "./cook-photos";
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
