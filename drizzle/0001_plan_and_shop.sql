CREATE TYPE "public"."meal_status" AS ENUM('planned', 'cooked', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."night_type" AS ENUM('cook', 'leftovers', 'takeout', 'eating_out', 'fend');--> statement-breakpoint
CREATE TYPE "public"."time_budget" AS ENUM('quick', 'normal', 'weekend', 'hands_off');--> statement-breakpoint
CREATE TABLE "bumped_meal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"side_recipe_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"from_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grocery_claim" (
	"week_plan_id" uuid NOT NULL,
	"section" text NOT NULL,
	"member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grocery_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_plan_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"quantity" double precision,
	"unit" text NOT NULL,
	"section" text NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_manual" boolean DEFAULT false NOT NULL,
	"is_staple" boolean DEFAULT false NOT NULL,
	"is_stale" boolean DEFAULT false NOT NULL,
	"checked" boolean DEFAULT false NOT NULL,
	"checked_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planned_meal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_plan_id" uuid NOT NULL,
	"date" date NOT NULL,
	"night_type" "night_type" DEFAULT 'cook' NOT NULL,
	"recipe_id" uuid,
	"side_recipe_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"eater_ids" uuid[],
	"servings" integer,
	"time_budget" time_budget DEFAULT 'normal' NOT NULL,
	"status" "meal_status" DEFAULT 'planned' NOT NULL,
	"notes" text,
	"cooked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "week_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_start" date NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "family_settings" ADD COLUMN "week_starts_on" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bumped_meal" ADD CONSTRAINT "bumped_meal_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_claim" ADD CONSTRAINT "grocery_claim_week_plan_id_week_plan_id_fk" FOREIGN KEY ("week_plan_id") REFERENCES "public"."week_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_claim" ADD CONSTRAINT "grocery_claim_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_item" ADD CONSTRAINT "grocery_item_week_plan_id_week_plan_id_fk" FOREIGN KEY ("week_plan_id") REFERENCES "public"."week_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_item" ADD CONSTRAINT "grocery_item_checked_by_member_id_member_id_fk" FOREIGN KEY ("checked_by_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_meal" ADD CONSTRAINT "planned_meal_week_plan_id_week_plan_id_fk" FOREIGN KEY ("week_plan_id") REFERENCES "public"."week_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_meal" ADD CONSTRAINT "planned_meal_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "grocery_claim_idx" ON "grocery_claim" USING btree ("week_plan_id","section");--> statement-breakpoint
CREATE UNIQUE INDEX "grocery_item_week_key_idx" ON "grocery_item" USING btree ("week_plan_id","key");--> statement-breakpoint
CREATE INDEX "grocery_item_week_idx" ON "grocery_item" USING btree ("week_plan_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "planned_meal_date_idx" ON "planned_meal" USING btree ("date");--> statement-breakpoint
CREATE INDEX "planned_meal_week_idx" ON "planned_meal" USING btree ("week_plan_id");--> statement-breakpoint
CREATE INDEX "planned_meal_recipe_idx" ON "planned_meal" USING btree ("recipe_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "week_plan_start_idx" ON "week_plan" USING btree ("week_start");