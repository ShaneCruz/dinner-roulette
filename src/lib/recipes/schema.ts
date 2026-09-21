import { z } from "zod";

export const STORE_SECTIONS = [
  "produce",
  "meat",
  "seafood",
  "deli",
  "dairy",
  "bakery",
  "frozen",
  "pantry",
  "spices",
  "international",
  "other",
] as const;
export type StoreSection = (typeof STORE_SECTIONS)[number];

export const STORE_SECTION_LABELS: Record<StoreSection, string> = {
  produce: "Produce",
  meat: "Meat",
  seafood: "Seafood",
  deli: "Deli",
  dairy: "Dairy & Eggs",
  bakery: "Bakery",
  frozen: "Frozen",
  pantry: "Pantry",
  spices: "Spices & Oils",
  international: "International",
  other: "Other",
};

/**
 * Units the scaler understands. "whole" is for countable things
 * ("2 onions"); "to_taste" never scales.
 */
export const UNITS = [
  "tsp",
  "tbsp",
  "cup",
  "fl_oz",
  "oz",
  "lb",
  "g",
  "kg",
  "ml",
  "l",
  "whole",
  "clove",
  "slice",
  "can",
  "jar",
  "package",
  "bunch",
  "head",
  "stalk",
  "sprig",
  "pinch",
  "to_taste",
] as const;
export type Unit = (typeof UNITS)[number];

export const COOK_METHODS = [
  "stovetop",
  "oven",
  "grill",
  "slow_cooker",
  "dutch_oven",
  "sheet_pan",
  "vitamix",
  "air_fryer",
  "no_cook",
] as const;
export type CookMethod = (typeof COOK_METHODS)[number];

export const COOK_METHOD_LABELS: Record<CookMethod, string> = {
  stovetop: "Stovetop",
  oven: "Oven",
  grill: "Grill",
  slow_cooker: "Slow cooker",
  dutch_oven: "Dutch oven",
  sheet_pan: "Sheet pan",
  vitamix: "Vitamix",
  air_fryer: "Air fryer",
  no_cook: "No cook",
};

export const RECIPE_TAGS = [
  "healthy",
  "comfort",
  "grilled",
  "one_pot",
  "kid_favorite",
  "soup",
  "pasta",
  "mexican",
  "italian",
  "greek",
  "american",
  "make_ahead",
  "high_protein",
  "vegetarian",
] as const;
export type RecipeTag = (typeof RECIPE_TAGS)[number];

export const RECIPE_TAG_LABELS: Record<RecipeTag, string> = {
  healthy: "Healthy",
  comfort: "Comfort food",
  grilled: "Grilled",
  one_pot: "One pot",
  kid_favorite: "Kid favorite",
  soup: "Soup",
  pasta: "Pasta",
  mexican: "Mexican",
  italian: "Italian",
  greek: "Greek",
  american: "American",
  make_ahead: "Make ahead",
  high_protein: "High protein",
  vegetarian: "Vegetarian",
};

export const HEALTH_LABELS = {
  healthy: "Healthy",
  balanced: "Balanced",
  comfort: "Comfort",
} as const;

export const SEASON_LABELS = {
  any: "Any season",
  warm: "Warm weather",
  cold: "Cold weather",
} as const;

export const VARIANT_KINDS = [
  "healthy",
  "mild",
  "protein_swap",
  "protein_boost",
  "kid",
] as const;
export type VariantKind = (typeof VARIANT_KINDS)[number];

export const VARIANT_KIND_LABELS: Record<VariantKind, string> = {
  healthy: "Healthy swap",
  mild: "Mild version",
  protein_swap: "Protein swap",
  protein_boost: "Protein boost",
  kid: "Kid version",
};

export const ingredientSchema = z.object({
  name: z.string().min(1),
  /** null means "some" (for example "salt, to taste") */
  quantity: z.number().positive().nullable(),
  unit: z.enum(UNITS),
  section: z.enum(STORE_SECTIONS),
  perishable: z.boolean(),
  note: z.string().optional(),
  optional: z.boolean().optional(),
});
export type IngredientInput = z.infer<typeof ingredientSchema>;

export const stepSchema = z.object({
  text: z.string().min(1),
  timerMinutes: z.number().int().positive().optional(),
});
export type StepInput = z.infer<typeof stepSchema>;

export const variantSchema = z.object({
  kind: z.enum(VARIANT_KINDS),
  label: z.string().min(1),
  description: z.string().min(1),
  /** Ingredient names (matching `ingredients[].name`) this variant removes */
  removes: z.array(z.string()).default([]),
  adds: z.array(ingredientSchema).default([]),
  extraSteps: z.array(z.string()).default([]),
  extraActiveMinutes: z.number().int().min(0).default(0),
  /** Ingredients this variant lets someone avoid, for matching hard nopes */
  avoids: z.array(z.string()).default([]),
});
export type VariantInput = z.infer<typeof variantSchema>;

export const recipeInputSchema = z
  .object({
    slug: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "lowercase words joined by dashes"),
    title: z.string().min(1),
    description: z.string().min(1),
    kind: z.enum(["main", "side"]),
    cuisine: z.string().min(1),
    tags: z.array(z.enum(RECIPE_TAGS)).default([]),
    method: z.enum(COOK_METHODS),
    /** Hands-on minutes: chopping, stirring, grilling */
    activeMinutes: z.number().int().positive(),
    /** Start to table, including simmering or slow cooking */
    totalMinutes: z.number().int().positive(),
    baseServings: z.number().int().positive(),
    /** 0 = no heat, 3 = hot */
    spiceLevel: z.number().int().min(0).max(3),
    /** How to give heat to only some portions, or null if it can't be split */
    spiceSplit: z.string().nullable(),
    seasonFit: z.enum(["any", "warm", "cold"]),
    /** Bad-weather fallback for grilled recipes */
    indoorMethod: z.string().nullable(),
    healthCategory: z.enum(["healthy", "balanced", "comfort"]),
    /** null uses the family default (14 days) */
    cooldownDays: z.number().int().positive().nullable(),
    ingredients: z.array(ingredientSchema).min(1),
    steps: z.array(stepSchema).min(1),
    variants: z.array(variantSchema).default([]),
    /** Slugs of side recipes that go well with this main */
    pairsWith: z.array(z.string()).default([]),
  })
  .refine((r) => r.totalMinutes >= r.activeMinutes, {
    message: "totalMinutes must be at least activeMinutes",
    path: ["totalMinutes"],
  });
export type RecipeInput = z.input<typeof recipeInputSchema>;
export type Recipe = z.output<typeof recipeInputSchema>;
