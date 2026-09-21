import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { IngredientInput, StepInput } from "@/lib/recipes/schema";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// ---------------------------------------------------------------------------
// Auth (Better Auth core tables). Only parents have accounts; kids are
// profiles picked on a signed-in device.
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  ...timestamps,
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  ...timestamps,
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  ...timestamps,
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// Family
// ---------------------------------------------------------------------------

export type GrillCaps = { summer: number; shoulder: number; winter: number };

/** Single row (id = 1) holding family-wide settings. */
export const familySettings = pgTable(
  "family_settings",
  {
    id: integer("id").primaryKey().default(1),
    familyName: text("family_name").notNull(),
    homeZip: text("home_zip"),
    timezone: text("timezone").notNull().default("America/Chicago"),
    defaultCooldownDays: integer("default_cooldown_days").notNull().default(14),
    healthyNightsTarget: integer("healthy_nights_target").notNull().default(5),
    weeknightActiveMinutes: integer("weeknight_active_minutes").notNull().default(30),
    appliances: text("appliances").array().notNull().default(sql`'{}'::text[]`),
    grillCaps: jsonb("grill_caps")
      .$type<GrillCaps>()
      .notNull()
      .default({ summer: 3, shoulder: 2, winter: 1 }),
    chaosSliceEnabled: boolean("chaos_slice_enabled").notNull().default(true),
    setupCompletedAt: timestamp("setup_completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [check("family_settings_singleton", sql`${t.id} = 1`)],
);

export const memberRole = pgEnum("member_role", ["parent", "kid"]);
export const humorDial = pgEnum("humor_dial", ["goofball", "dry"]);
export const presence = pgEnum("presence", ["home", "away"]);

export const member = pgTable(
  "member",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    role: memberRole("role").notNull(),
    birthYear: integer("birth_year"),
    avatarEmoji: text("avatar_emoji").notNull().default("🙂"),
    avatarColor: text("avatar_color").notNull().default("#f97316"),
    chefTitle: text("chef_title"),
    humorDial: humorDial("humor_dial").notNull().default("goofball"),
    /** 0 = no heat at all, 3 = bring the ghost peppers */
    spiceTolerance: integer("spice_tolerance").notNull().default(1),
    prefersHighProtein: boolean("prefers_high_protein").notNull().default(false),
    wantsHealthySwaps: boolean("wants_healthy_swaps").notNull().default(false),
    /** Where this person is when no availability range says otherwise */
    defaultPresence: presence("default_presence").notNull().default("home"),
    pinHash: text("pin_hash"),
    /** Google account email; parents only */
    authEmail: text("auth_email").unique(),
    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [check("member_spice_range", sql`${t.spiceTolerance} between 0 and 3`)],
);

/**
 * Date ranges that override a member's default presence: school breaks
 * for a boarding-school kid, a parent's trip, a sleepover.
 * Dates are inclusive and mean "dinner that day".
 */
export const memberAvailability = pgTable(
  "member_availability",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    presence: presence("presence").notNull(),
    label: text("label").notNull(),
    /** Needs a parent to confirm before it counts */
    tentative: boolean("tentative").notNull().default(false),
    note: text("note"),
    ...timestamps,
  },
  (t) => [
    index("member_availability_member_idx").on(t.memberId, t.startDate),
    check("member_availability_range", sql`${t.endDate} >= ${t.startDate}`),
  ],
);

export const foodRuleKind = pgEnum("food_rule_kind", ["nope", "love"]);

/**
 * Explicit likes and hard nopes. A nope targets an ingredient keyword
 * ("ground beef") or a specific recipe; a love targets a recipe.
 */
export const memberFoodRule = pgTable(
  "member_food_rule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    kind: foodRuleKind("kind").notNull(),
    ingredient: text("ingredient"),
    recipeId: uuid("recipe_id").references(() => recipe.id, { onDelete: "cascade" }),
    note: text("note"),
    ...timestamps,
  },
  (t) => [
    index("member_food_rule_member_idx").on(t.memberId),
    check(
      "member_food_rule_target",
      sql`(${t.ingredient} is not null) <> (${t.recipeId} is not null)`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------

export const recipeKind = pgEnum("recipe_kind", ["main", "side"]);
export const recipeSource = pgEnum("recipe_source", ["starter", "manual", "ai", "import"]);
export const recipeStatus = pgEnum("recipe_status", ["draft", "approved"]);
export const seasonFit = pgEnum("season_fit", ["any", "warm", "cold"]);
export const healthCategory = pgEnum("health_category", ["healthy", "balanced", "comfort"]);

export const recipe = pgTable(
  "recipe",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    kind: recipeKind("kind").notNull(),
    cuisine: text("cuisine").notNull(),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    method: text("method").notNull(),
    activeMinutes: integer("active_minutes").notNull(),
    totalMinutes: integer("total_minutes").notNull(),
    baseServings: integer("base_servings").notNull(),
    spiceLevel: integer("spice_level").notNull().default(0),
    spiceSplit: text("spice_split"),
    seasonFit: seasonFit("season_fit").notNull().default("any"),
    indoorMethod: text("indoor_method"),
    healthCategory: healthCategory("health_category").notNull(),
    cooldownDays: integer("cooldown_days"),
    steps: jsonb("steps").$type<StepInput[]>().notNull(),
    pairsWith: text("pairs_with").array().notNull().default(sql`'{}'::text[]`),
    source: recipeSource("source").notNull(),
    sourceUrl: text("source_url"),
    status: recipeStatus("status").notNull().default("approved"),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdByMemberId: uuid("created_by_member_id").references(() => member.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("recipe_slug_idx").on(t.slug),
    check("recipe_spice_range", sql`${t.spiceLevel} between 0 and 3`),
  ],
);

export const recipeIngredient = pgTable(
  "recipe_ingredient",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    name: text("name").notNull(),
    quantity: doublePrecision("quantity"),
    unit: text("unit").notNull(),
    section: text("section").notNull(),
    perishable: boolean("perishable").notNull(),
    note: text("note"),
    optional: boolean("optional").notNull().default(false),
  },
  (t) => [
    index("recipe_ingredient_recipe_idx").on(t.recipeId, t.position),
    index("recipe_ingredient_name_idx").on(t.name),
  ],
);

export const recipeVariant = pgTable(
  "recipe_variant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    kind: text("kind").notNull(),
    label: text("label").notNull(),
    description: text("description").notNull(),
    removes: text("removes").array().notNull().default(sql`'{}'::text[]`),
    adds: jsonb("adds").$type<IngredientInput[]>().notNull().default([]),
    extraSteps: text("extra_steps").array().notNull().default(sql`'{}'::text[]`),
    extraActiveMinutes: integer("extra_active_minutes").notNull().default(0),
    avoids: text("avoids").array().notNull().default(sql`'{}'::text[]`),
  },
  (t) => [index("recipe_variant_recipe_idx").on(t.recipeId, t.position)],
);
