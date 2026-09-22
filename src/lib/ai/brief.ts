import "server-only";
import { and, eq, gte, isNull } from "drizzle-orm";
import type { Database } from "@/db";
import { familySettings, member, memberFoodRule, rating, recipe, recipeIngredient } from "@/db/schema";
import { APPLIANCES } from "@/lib/family";
import type { FamilyBrief } from "./recipes";

/** The family, described for Claude without names. */
export async function loadFamilyBrief(db: Database): Promise<FamilyBrief> {
  const [[settings], members, nopes, ingredients, sides, loved] = await Promise.all([
    db.select().from(familySettings).limit(1),
    db.select().from(member).where(isNull(member.archivedAt)),
    db.select({ ingredient: memberFoodRule.ingredient }).from(memberFoodRule).where(eq(memberFoodRule.kind, "nope")),
    db.selectDistinct({ name: recipeIngredient.name }).from(recipeIngredient),
    db
      .select({ slug: recipe.slug, title: recipe.title })
      .from(recipe)
      .where(and(eq(recipe.kind, "side"), isNull(recipe.archivedAt))),
    db
      .selectDistinct({ title: recipe.title })
      .from(rating)
      .innerJoin(recipe, eq(recipe.id, rating.recipeId))
      .where(gte(rating.stars, 4)),
  ]);
  const applianceLabels = new Map<string, string>(APPLIANCES.map((a) => [a.id, a.label]));
  return {
    spiceTolerances: members.length ? members.map((m) => m.spiceTolerance) : [1],
    nopes: [...new Set(nopes.map((n) => n.ingredient).filter((n): n is string => Boolean(n)))],
    wantsHighProtein: members.some((m) => m.prefersHighProtein),
    wantsHealthySwaps: members.some((m) => m.wantsHealthySwaps),
    appliances: (settings?.appliances ?? []).map((a) => applianceLabels.get(a) ?? a),
    weeknightActiveMinutes: settings?.weeknightActiveMinutes ?? 30,
    householdSize: Math.max(members.filter((m) => m.defaultPresence === "home").length, 1),
    knownIngredients: ingredients.map((i) => i.name).sort().slice(0, 400),
    sides,
    favorites: loved.map((l) => l.title).slice(0, 15),
  };
}
