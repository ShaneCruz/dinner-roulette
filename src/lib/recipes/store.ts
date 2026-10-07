import { and, asc, eq, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { findSimilar } from "./similar";
import { recipe, recipeIngredient, recipePhoto, recipeVariant, type Nutrition } from "@/db/schema";
import {
  recipeInputSchema,
  type CookMethod,
  type Recipe,
  type RecipeInput,
  type RecipeTag,
  type StoreSection,
  type Unit,
  type VariantKind,
} from "./schema";

export type RecipeSource = (typeof recipe.$inferSelect)["source"];

/** A rating from the site a recipe came from ("Allrecipes, 4.8 from 12,345 ratings"). */
export type SourceRating = { site: string | null; rating: number | null; count: number | null };

export type StoredRecipe = Recipe & {
  id: string;
  source: RecipeSource;
  sourceUrl: string | null;
  imageUrl: string | null;
  photoAt: Date | null;
  status: "draft" | "approved";
  notes: string | null;
  archivedAt: Date | null;
  nutrition: Nutrition | null;
  sourceRating: SourceRating | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RecipeSummary = Pick<
  StoredRecipe,
  | "id"
  | "slug"
  | "title"
  | "description"
  | "kind"
  | "cuisine"
  | "tags"
  | "method"
  | "activeMinutes"
  | "totalMinutes"
  | "spiceLevel"
  | "healthCategory"
  | "seasonFit"
  | "status"
  | "imageUrl"
  | "photoAt"
>;

type SaveOptions = {
  source: RecipeSource;
  /** Kept only when the caller knows it still matches; any edit clears it for re-estimating */
  nutrition?: Nutrition | null;
  /** Rating on the site it came from; leave undefined to keep what's there */
  sourceRating?: SourceRating | null;
  sourceUrl?: string | null;
  /** The source site's picture; leave undefined to keep what's there */
  imageUrl?: string | null;
  status?: "draft" | "approved";
  notes?: string | null;
  createdByMemberId?: string | null;
};

/**
 * Creates or replaces a recipe with its ingredients and variants.
 * Returns the recipe id.
 */
export async function saveRecipe(
  db: Database,
  input: RecipeInput,
  options: SaveOptions,
  existingId?: string,
): Promise<string> {
  const parsed = recipeInputSchema.parse(input);
  const columns = {
    slug: parsed.slug,
    title: parsed.title,
    description: parsed.description,
    kind: parsed.kind,
    cuisine: parsed.cuisine,
    tags: parsed.tags,
    method: parsed.method,
    activeMinutes: parsed.activeMinutes,
    totalMinutes: parsed.totalMinutes,
    baseServings: parsed.baseServings,
    spiceLevel: parsed.spiceLevel,
    spiceSplit: parsed.spiceSplit,
    seasonFit: parsed.seasonFit,
    indoorMethod: parsed.indoorMethod,
    healthCategory: parsed.healthCategory,
    cooldownDays: parsed.cooldownDays,
    steps: parsed.steps,
    pairsWith: parsed.pairsWith,
    source: options.source,
    sourceUrl: options.sourceUrl ?? null,
    status: options.status ?? "approved",
    notes: options.notes ?? null,
    nutrition: options.nutrition ?? null,
    ...(options.sourceRating !== undefined
      ? {
          sourceName: options.sourceRating?.site ?? null,
          sourceRating: options.sourceRating?.rating ?? null,
          sourceRatingCount: options.sourceRating?.count ?? null,
        }
      : {}),
    ...(options.imageUrl !== undefined ? { imageUrl: options.imageUrl } : {}),
  };

  return db.transaction(async (tx) => {
    let id: string;
    if (existingId) {
      await tx.update(recipe).set(columns).where(eq(recipe.id, existingId));
      await tx.delete(recipeIngredient).where(eq(recipeIngredient.recipeId, existingId));
      await tx.delete(recipeVariant).where(eq(recipeVariant.recipeId, existingId));
      id = existingId;
    } else {
      const [created] = await tx
        .insert(recipe)
        .values({ ...columns, createdByMemberId: options.createdByMemberId ?? null })
        .returning({ id: recipe.id });
      id = created.id;
    }

    await tx.insert(recipeIngredient).values(
      parsed.ingredients.map((ingredient, position) => ({
        recipeId: id,
        position,
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        section: ingredient.section,
        perishable: ingredient.perishable,
        note: ingredient.note ?? null,
        optional: ingredient.optional ?? false,
      })),
    );
    if (parsed.variants.length > 0) {
      await tx.insert(recipeVariant).values(
        parsed.variants.map((variant, position) => ({ recipeId: id, position, ...variant })),
      );
    }
    return id;
  });
}

export async function getRecipe(
  db: Database,
  by: { id: string } | { slug: string },
): Promise<StoredRecipe | null> {
  const [row] = await db
    .select()
    .from(recipe)
    .where("id" in by ? eq(recipe.id, by.id) : eq(recipe.slug, by.slug))
    .limit(1);
  if (!row) return null;

  const [ingredients, variants] = await Promise.all([
    db
      .select()
      .from(recipeIngredient)
      .where(eq(recipeIngredient.recipeId, row.id))
      .orderBy(asc(recipeIngredient.position)),
    db
      .select()
      .from(recipeVariant)
      .where(eq(recipeVariant.recipeId, row.id))
      .orderBy(asc(recipeVariant.position)),
  ]);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    kind: row.kind,
    cuisine: row.cuisine,
    tags: row.tags as RecipeTag[],
    method: row.method as CookMethod,
    activeMinutes: row.activeMinutes,
    totalMinutes: row.totalMinutes,
    baseServings: row.baseServings,
    spiceLevel: row.spiceLevel,
    spiceSplit: row.spiceSplit,
    seasonFit: row.seasonFit,
    indoorMethod: row.indoorMethod,
    healthCategory: row.healthCategory,
    cooldownDays: row.cooldownDays,
    steps: row.steps,
    pairsWith: row.pairsWith,
    source: row.source,
    sourceUrl: row.sourceUrl,
    imageUrl: row.imageUrl,
    photoAt: row.photoAt,
    status: row.status,
    notes: row.notes,
    archivedAt: row.archivedAt,
    nutrition: row.nutrition,
    sourceRating:
      row.sourceRating !== null || row.sourceName
        ? { site: row.sourceName, rating: row.sourceRating, count: row.sourceRatingCount }
        : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ingredients: ingredients.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unit: i.unit as Unit,
      section: i.section as StoreSection,
      perishable: i.perishable,
      ...(i.note ? { note: i.note } : {}),
      ...(i.optional ? { optional: true } : {}),
    })),
    variants: variants.map((v) => ({
      kind: v.kind as VariantKind,
      label: v.label,
      description: v.description,
      removes: v.removes,
      adds: v.adds,
      extraSteps: v.extraSteps,
      extraActiveMinutes: v.extraActiveMinutes,
      avoids: v.avoids,
    })),
  };
}

export async function listRecipes(
  db: Database,
  filters: { search?: string; kind?: "main" | "side"; includeArchived?: boolean; onlyArchived?: boolean } = {},
): Promise<RecipeSummary[]> {
  const conditions = [];
  if (filters.onlyArchived) conditions.push(isNotNull(recipe.archivedAt));
  else if (!filters.includeArchived) conditions.push(isNull(recipe.archivedAt));
  if (filters.kind) conditions.push(eq(recipe.kind, filters.kind));
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    conditions.push(
      or(
        ilike(recipe.title, term),
        ilike(recipe.cuisine, term),
        sql`exists (select 1 from ${recipeIngredient} where ${recipeIngredient.recipeId} = ${recipe.id} and ${recipeIngredient.name} ilike ${term})`,
      ),
    );
  }

  const rows = await db
    .select({
      id: recipe.id,
      slug: recipe.slug,
      title: recipe.title,
      description: recipe.description,
      kind: recipe.kind,
      cuisine: recipe.cuisine,
      tags: recipe.tags,
      method: recipe.method,
      activeMinutes: recipe.activeMinutes,
      totalMinutes: recipe.totalMinutes,
      spiceLevel: recipe.spiceLevel,
      healthCategory: recipe.healthCategory,
      seasonFit: recipe.seasonFit,
      status: recipe.status,
      imageUrl: recipe.imageUrl,
      photoAt: recipe.photoAt,
    })
    .from(recipe)
    .where(and(...conditions))
    .orderBy(asc(recipe.kind), asc(recipe.title));

  return rows.map((r) => ({
    ...r,
    tags: r.tags as RecipeTag[],
    method: r.method as CookMethod,
  }));
}

export async function setRecipeArchived(db: Database, id: string, archived: boolean) {
  await db
    .update(recipe)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(recipe.id, id));
}

/** Slug not taken yet, adding -2, -3... when needed. */
export async function uniqueSlug(db: Database, base: string, ignoreId?: string): Promise<string> {
  const rows = await db
    .select({ id: recipe.id, slug: recipe.slug })
    .from(recipe)
    .where(or(eq(recipe.slug, base), ilike(recipe.slug, `${base}-%`)));
  const taken = new Set(rows.filter((r) => r.id !== ignoreId).map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "recipe"
  );
}

export async function existingSlugs(db: Database, slugs: string[]): Promise<Set<string>> {
  if (slugs.length === 0) return new Set();
  const rows = await db
    .select({ slug: recipe.slug })
    .from(recipe)
    .where(inArray(recipe.slug, slugs));
  return new Set(rows.map((r) => r.slug));
}

export async function deleteRecipe(db: Database, id: string) {
  await db.delete(recipe).where(eq(recipe.id, id));
}

/** Other recipes whose titles share a meaningful word, e.g. two chilis. */
export async function similarRecipes(db: Database, id: string, title: string): Promise<RecipeSummary[]> {
  const all = await listRecipes(db);
  return findSimilar(
    title,
    all.filter((r) => r.id !== id),
  );
}

/** Saves the family's own photo of a recipe, replacing any earlier one. */
export async function saveRecipePhoto(db: Database, recipeId: string, photo: { contentType: string; data: string }) {
  await db.transaction(async (tx) => {
    await tx
      .insert(recipePhoto)
      .values({ recipeId, ...photo })
      .onConflictDoUpdate({ target: recipePhoto.recipeId, set: { ...photo, updatedAt: new Date() } });
    // Not an edit to the recipe itself, so leave updatedAt alone.
    await tx
      .update(recipe)
      .set({ photoAt: new Date(), updatedAt: sql`${recipe.updatedAt}` as unknown as Date })
      .where(eq(recipe.id, recipeId));
  });
}

export async function removeRecipePhoto(db: Database, recipeId: string) {
  await db.transaction(async (tx) => {
    await tx.delete(recipePhoto).where(eq(recipePhoto.recipeId, recipeId));
    await tx
      .update(recipe)
      .set({ photoAt: null, updatedAt: sql`${recipe.updatedAt}` as unknown as Date })
      .where(eq(recipe.id, recipeId));
  });
}

export async function getRecipePhoto(db: Database, recipeId: string) {
  const [row] = await db.select().from(recipePhoto).where(eq(recipePhoto.recipeId, recipeId)).limit(1);
  return row ?? null;
}

/** Sets (or clears) the picture from the source site, without touching anything else. */
export async function setRecipeImageUrl(db: Database, recipeId: string, imageUrl: string | null) {
  await db
    .update(recipe)
    .set({ imageUrl, updatedAt: sql`${recipe.updatedAt}` as unknown as Date })
    .where(eq(recipe.id, recipeId));
}

/** "https://www.allrecipes.com/recipe/123/x/?utm=y#z" → "allrecipes.com/recipe/123/x", for matching a page sent twice. */
export function sameSourceKey(url: string): string | null {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return null;
  }
}

/** A recipe already imported from the same page, if any. */
export async function findBySourceUrl(db: Database, url: string): Promise<{ id: string; slug: string; imageUrl: string | null } | null> {
  const key = sameSourceKey(url);
  if (!key) return null;
  const rows = await db
    .select({ id: recipe.id, slug: recipe.slug, imageUrl: recipe.imageUrl, sourceUrl: recipe.sourceUrl })
    .from(recipe)
    .where(and(isNotNull(recipe.sourceUrl), isNull(recipe.archivedAt)));
  const found = rows.find((r) => r.sourceUrl && sameSourceKey(r.sourceUrl) === key);
  return found ? { id: found.id, slug: found.slug, imageUrl: found.imageUrl } : null;
}
