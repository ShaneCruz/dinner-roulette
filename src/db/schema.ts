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
import type { IngredientInput, Recipe, StepInput } from "@/lib/recipes/schema";

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
/** Which phone reminders the family wants. */
export type ReminderPrefs = {
  /** Night before: take the meat out of the freezer */
  thaw: boolean;
  /** "Start cooking now" based on the recipe's total time */
  start: boolean;
  /** After dinner: rate it */
  rate: boolean;
  /** Friday: next week was planned */
  autopilot: boolean;
  /** A recipe tweak is ready to review */
  proposals: boolean;
};

export const DEFAULT_REMINDERS: ReminderPrefs = { thaw: true, start: true, rate: true, autopilot: true, proposals: true };

export const familySettings = pgTable(
  "family_settings",
  {
    id: integer("id").primaryKey().default(1),
    familyName: text("family_name").notNull(),
    homeZip: text("home_zip"),
    /** Looked up from homeZip for weather forecasts */
    homeLatitude: doublePrecision("home_latitude"),
    homeLongitude: doublePrecision("home_longitude"),
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
    /** 0 = Sunday … 6 = Saturday; the planning week starts on this day */
    weekStartsOn: integer("week_starts_on").notNull().default(0),
    /** When dinner is usually on the table, "HH:MM" in the family's timezone */
    dinnerTime: text("dinner_time").notNull().default("18:00"),
    /** Plan next week automatically on autopilotDay (0 = Sunday … 6 = Saturday) */
    autopilotEnabled: boolean("autopilot_enabled").notNull().default(true),
    autopilotDay: integer("autopilot_day").notNull().default(5),
    reminders: jsonb("reminders").$type<ReminderPrefs>().notNull().default(DEFAULT_REMINDERS),
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

/** Approximate nutrition for one serving, estimated by AI from the ingredients. */
export type Nutrition = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fiberG: number;
  fatG: number;
  sodiumMg: number;
  /** A short caveat, e.g. "assumes 80/20 ground beef" */
  note: string | null;
  estimatedAt: string;
};

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
    /** Per serving; null until estimated (and cleared when the recipe changes) */
    nutrition: jsonb("nutrition").$type<Nutrition>(),
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

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

export const nightType = pgEnum("night_type", [
  "cook",
  "leftovers",
  "takeout",
  "eating_out",
  "fend",
]);
export const timeBudget = pgEnum("time_budget", ["quick", "normal", "weekend", "hands_off"]);
export const mealStatus = pgEnum("meal_status", ["planned", "cooked", "skipped"]);

export const weekPlan = pgTable(
  "week_plan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** First night of the planning week */
    weekStart: date("week_start").notNull(),
    notes: text("notes"),
    /** When autopilot planned this week (so it only happens once) */
    autopilotAt: timestamp("autopilot_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("week_plan_start_idx").on(t.weekStart)],
);

/** One dinner per date. */
export const plannedMeal = pgTable(
  "planned_meal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weekPlanId: uuid("week_plan_id")
      .notNull()
      .references(() => weekPlan.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    nightType: nightType("night_type").notNull().default("cook"),
    recipeId: uuid("recipe_id").references(() => recipe.id, { onDelete: "set null" }),
    sideRecipeIds: uuid("side_recipe_ids").array().notNull().default(sql`'{}'::uuid[]`),
    /** Who is eating; null means "whoever is home that day" */
    eaterIds: uuid("eater_ids").array(),
    /** null means one serving per eater */
    servings: integer("servings"),
    timeBudget: timeBudget("time_budget").notNull().default("normal"),
    status: mealStatus("status").notNull().default("planned"),
    notes: text("notes"),
    cookedAt: timestamp("cooked_at", { withTimezone: true }),
    /** Whose turn this night was (their tastes counted triple) */
    favoredMemberId: uuid("favored_member_id").references(() => member.id, { onDelete: "set null" }),
    /** Short "why this dinner" note when the planner suggested it */
    suggestionReason: text("suggestion_reason"),
    /** Where takeout came from, on takeout nights */
    restaurantId: uuid("restaurant_id").references(() => restaurant.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("planned_meal_date_idx").on(t.date),
    index("planned_meal_week_idx").on(t.weekPlanId),
    index("planned_meal_recipe_idx").on(t.recipeId, t.date),
  ],
);

/**
 * Meals that got skipped but whose groceries were already bought. They wait
 * here to be dropped onto a later night.
 */
export const bumpedMeal = pgTable("bumped_meal", {
  id: uuid("id").primaryKey().defaultRandom(),
  recipeId: uuid("recipe_id")
    .notNull()
    .references(() => recipe.id, { onDelete: "cascade" }),
  sideRecipeIds: uuid("side_recipe_ids").array().notNull().default(sql`'{}'::uuid[]`),
  fromDate: date("from_date").notNull(),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// Groceries
// ---------------------------------------------------------------------------

export type GrocerySource = { recipeTitle: string; date: string };

export const groceryItem = pgTable(
  "grocery_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weekPlanId: uuid("week_plan_id")
      .notNull()
      .references(() => weekPlan.id, { onDelete: "cascade" }),
    /** Stable identity across regenerations: name + unit family */
    key: text("key").notNull(),
    name: text("name").notNull(),
    quantity: doublePrecision("quantity"),
    unit: text("unit").notNull(),
    section: text("section").notNull(),
    sources: jsonb("sources").$type<GrocerySource[]>().notNull().default([]),
    isManual: boolean("is_manual").notNull().default(false),
    isStaple: boolean("is_staple").notNull().default(false),
    /** Checked off, then the plan changed so it isn't needed any more */
    isStale: boolean("is_stale").notNull().default(false),
    checked: boolean("checked").notNull().default(false),
    checkedByMemberId: uuid("checked_by_member_id").references(() => member.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("grocery_item_week_key_idx").on(t.weekPlanId, t.key),
    index("grocery_item_week_idx").on(t.weekPlanId, t.updatedAt),
  ],
);

/** "I've got produce": who is shopping which aisle. */
export const groceryClaim = pgTable(
  "grocery_claim",
  {
    weekPlanId: uuid("week_plan_id")
      .notNull()
      .references(() => weekPlan.id, { onDelete: "cascade" }),
    section: text("section").notNull(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("grocery_claim_idx").on(t.weekPlanId, t.section)],
);

// ---------------------------------------------------------------------------
// Ratings
// ---------------------------------------------------------------------------

/** One person's verdict on one dinner. Parents can enter them for kids. */
export const rating = pgTable(
  "rating",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    plannedMealId: uuid("planned_meal_id")
      .notNull()
      .references(() => plannedMeal.id, { onDelete: "cascade" }),
    /** The recipe at the time of rating, so history survives plan edits */
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    enteredByMemberId: uuid("entered_by_member_id").references(() => member.id, { onDelete: "set null" }),
    /** 1 = never again … 5 = make it every week */
    stars: integer("stars").notNull(),
    reasons: text("reasons").array().notNull().default(sql`'{}'::text[]`),
    note: text("note"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("rating_meal_member_idx").on(t.plannedMealId, t.memberId),
    index("rating_recipe_idx").on(t.recipeId),
    index("rating_member_idx").on(t.memberId),
    check("rating_stars_range", sql`${t.stars} between 1 and 5`),
  ],
);

// ---------------------------------------------------------------------------
// Takeout
// ---------------------------------------------------------------------------

export type RestaurantDish = {
  name: string;
  description: string | null;
  price: string | null;
  tags: string[];
};

export type RestaurantPick = {
  /** Member id the pick is for (mapped back from an anonymous label) */
  memberId: string;
  dish: string;
  why: string;
};

export type RestaurantResearch = {
  summary: string;
  menuUrl: string | null;
  priceRange: string | null;
  orderingTips: string | null;
  dishes: RestaurantDish[];
  picks: RestaurantPick[];
  familyOrder: string | null;
  sources: { title: string; url: string }[];
  /** "Person A" → member id, to show names in place of the anonymous labels */
  labels?: Record<string, string>;
};

/** How someone feels about a restaurant overall. */
export type RestaurantFeeling = "love" | "fine" | "meh";

/** The family's usual order: each person's go-to dishes, plus things for the table. */
export type RestaurantFavorites = {
  people: Record<string, { dishes: string[]; feeling: RestaurantFeeling | null }>;
  shared: string[];
};

export const restaurant = pgTable("restaurant", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  cuisine: text("cuisine").notNull(),
  /** Town or neighborhood, to find the right location */
  area: text("area"),
  website: text("website"),
  phone: text("phone"),
  notes: text("notes"),
  research: jsonb("research").$type<RestaurantResearch>(),
  favorites: jsonb("favorites").$type<RestaurantFavorites>(),
  researchedAt: timestamp("researched_at", { withTimezone: true }),
  researchError: text("research_error"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// Sunday session, cards, and the wheel
// ---------------------------------------------------------------------------

/** A swipe in the Sunday session: -1 nope, 1 yes, 2 love (4 when doubled). */
export const sessionVote = pgTable(
  "session_vote",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weekStart: date("week_start").notNull(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    vote: integer("vote").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("session_vote_idx").on(t.weekStart, t.memberId, t.recipeId)],
);

export const cardType = pgEnum("card_type", ["veto", "double_down", "respin", "chefs_pick"]);

/**
 * Power-up cards a parent handed out (or the app awarded). Vetoes don't
 * need grants: every kid gets one per week, tracked in cardUse.
 */
export const cardGrant = pgTable("card_grant", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => member.id, { onDelete: "cascade" }),
  card: cardType("card").notNull(),
  reason: text("reason"),
  grantedByMemberId: uuid("granted_by_member_id").references(() => member.id, { onDelete: "set null" }),
  usedAt: timestamp("used_at", { withTimezone: true }),
  ...timestamps,
});

export const cardUse = pgTable(
  "card_use",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    card: cardType("card").notNull(),
    weekStart: date("week_start").notNull(),
    recipeId: uuid("recipe_id").references(() => recipe.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("card_use_week_idx").on(t.weekStart, t.memberId)],
);

export const wheelSpin = pgTable("wheel_spin", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: date("date").notNull(),
  spunByMemberId: uuid("spun_by_member_id").references(() => member.id, { onDelete: "set null" }),
  recipeId: uuid("recipe_id").references(() => recipe.id, { onDelete: "set null" }),
  /** Set when the chaos slice came up */
  chaos: text("chaos"),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// Recipes that learn, reminders, and autopilot
// ---------------------------------------------------------------------------

export const proposalStatus = pgEnum("proposal_status", ["pending", "accepted", "dismissed"]);

/** An AI-suggested change to a recipe, from ratings or a parent's request, waiting for a parent. */
export const recipeProposal = pgTable(
  "recipe_proposal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    /** What prompted it: the family's ratings, or a parent asking */
    trigger: text("trigger").$type<"ratings" | "request">().notNull(),
    request: text("request"),
    summary: text("summary").notNull(),
    changes: text("changes").array().notNull().default(sql`'{}'::text[]`),
    proposed: jsonb("proposed").$type<Recipe>().notNull(),
    basedOnRatingIds: uuid("based_on_rating_ids").array().notNull().default(sql`'{}'::uuid[]`),
    status: proposalStatus("status").notNull().default("pending"),
    createdByMemberId: uuid("created_by_member_id").references(() => member.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("recipe_proposal_recipe_idx").on(t.recipeId, t.status)],
);

/** The recipe as it was before an accepted change, so it can be undone. */
export const recipeRevision = pgTable("recipe_revision", {
  id: uuid("id").primaryKey().defaultRandom(),
  recipeId: uuid("recipe_id")
    .notNull()
    .references(() => recipe.id, { onDelete: "cascade" }),
  snapshot: jsonb("snapshot").$type<Recipe>().notNull(),
  reason: text("reason").notNull(),
  ...timestamps,
});

/** A phone or browser that asked for reminders, and whose it is. */
export const pushSubscription = pgTable("push_subscription", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => member.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  failures: integer("failures").notNull().default(0),
  ...timestamps,
});

/** Reminders already sent, so each one goes out once. */
export const notificationLog = pgTable("notification_log", {
  key: text("key").primaryKey(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});
