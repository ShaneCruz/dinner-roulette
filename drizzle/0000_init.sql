CREATE TYPE "public"."food_rule_kind" AS ENUM('nope', 'love');--> statement-breakpoint
CREATE TYPE "public"."health_category" AS ENUM('healthy', 'balanced', 'comfort');--> statement-breakpoint
CREATE TYPE "public"."humor_dial" AS ENUM('goofball', 'dry');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('parent', 'kid');--> statement-breakpoint
CREATE TYPE "public"."presence" AS ENUM('home', 'away');--> statement-breakpoint
CREATE TYPE "public"."recipe_kind" AS ENUM('main', 'side');--> statement-breakpoint
CREATE TYPE "public"."recipe_source" AS ENUM('starter', 'manual', 'ai', 'import');--> statement-breakpoint
CREATE TYPE "public"."recipe_status" AS ENUM('draft', 'approved');--> statement-breakpoint
CREATE TYPE "public"."season_fit" AS ENUM('any', 'warm', 'cold');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"family_name" text NOT NULL,
	"home_zip" text,
	"timezone" text DEFAULT 'America/Chicago' NOT NULL,
	"default_cooldown_days" integer DEFAULT 14 NOT NULL,
	"healthy_nights_target" integer DEFAULT 5 NOT NULL,
	"weeknight_active_minutes" integer DEFAULT 30 NOT NULL,
	"appliances" text[] DEFAULT '{}'::text[] NOT NULL,
	"grill_caps" jsonb DEFAULT '{"summer":3,"shoulder":2,"winter":1}'::jsonb NOT NULL,
	"chaos_slice_enabled" boolean DEFAULT true NOT NULL,
	"setup_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "family_settings_singleton" CHECK ("family_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"role" "member_role" NOT NULL,
	"birth_year" integer,
	"avatar_emoji" text DEFAULT '🙂' NOT NULL,
	"avatar_color" text DEFAULT '#f97316' NOT NULL,
	"chef_title" text,
	"humor_dial" "humor_dial" DEFAULT 'goofball' NOT NULL,
	"spice_tolerance" integer DEFAULT 1 NOT NULL,
	"prefers_high_protein" boolean DEFAULT false NOT NULL,
	"wants_healthy_swaps" boolean DEFAULT false NOT NULL,
	"default_presence" "presence" DEFAULT 'home' NOT NULL,
	"pin_hash" text,
	"auth_email" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_auth_email_unique" UNIQUE("auth_email"),
	CONSTRAINT "member_spice_range" CHECK ("member"."spice_tolerance" between 0 and 3)
);
--> statement-breakpoint
CREATE TABLE "member_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"presence" "presence" NOT NULL,
	"label" text NOT NULL,
	"tentative" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_availability_range" CHECK ("member_availability"."end_date" >= "member_availability"."start_date")
);
--> statement-breakpoint
CREATE TABLE "member_food_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"kind" "food_rule_kind" NOT NULL,
	"ingredient" text,
	"recipe_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_food_rule_target" CHECK (("member_food_rule"."ingredient" is not null) <> ("member_food_rule"."recipe_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "recipe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"kind" "recipe_kind" NOT NULL,
	"cuisine" text NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"method" text NOT NULL,
	"active_minutes" integer NOT NULL,
	"total_minutes" integer NOT NULL,
	"base_servings" integer NOT NULL,
	"spice_level" integer DEFAULT 0 NOT NULL,
	"spice_split" text,
	"season_fit" "season_fit" DEFAULT 'any' NOT NULL,
	"indoor_method" text,
	"health_category" "health_category" NOT NULL,
	"cooldown_days" integer,
	"steps" jsonb NOT NULL,
	"pairs_with" text[] DEFAULT '{}'::text[] NOT NULL,
	"source" "recipe_source" NOT NULL,
	"source_url" text,
	"status" "recipe_status" DEFAULT 'approved' NOT NULL,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_spice_range" CHECK ("recipe"."spice_level" between 0 and 3)
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredient" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"quantity" double precision,
	"unit" text NOT NULL,
	"section" text NOT NULL,
	"perishable" boolean NOT NULL,
	"note" text,
	"optional" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_variant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"description" text NOT NULL,
	"removes" text[] DEFAULT '{}'::text[] NOT NULL,
	"adds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"extra_steps" text[] DEFAULT '{}'::text[] NOT NULL,
	"extra_active_minutes" integer DEFAULT 0 NOT NULL,
	"avoids" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_availability" ADD CONSTRAINT "member_availability_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_food_rule" ADD CONSTRAINT "member_food_rule_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_food_rule" ADD CONSTRAINT "member_food_rule_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_created_by_member_id_member_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_variant" ADD CONSTRAINT "recipe_variant_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_availability_member_idx" ON "member_availability" USING btree ("member_id","start_date");--> statement-breakpoint
CREATE INDEX "member_food_rule_member_idx" ON "member_food_rule" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_slug_idx" ON "recipe" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "recipe_ingredient_recipe_idx" ON "recipe_ingredient" USING btree ("recipe_id","position");--> statement-breakpoint
CREATE INDEX "recipe_ingredient_name_idx" ON "recipe_ingredient" USING btree ("name");--> statement-breakpoint
CREATE INDEX "recipe_variant_recipe_idx" ON "recipe_variant" USING btree ("recipe_id","position");