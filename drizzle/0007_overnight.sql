CREATE TYPE "public"."proposal_status" AS ENUM('pending', 'accepted', 'dismissed');--> statement-breakpoint
CREATE TABLE "notification_log" (
	"key" text PRIMARY KEY NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"failures" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscription_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "recipe_proposal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"trigger" text NOT NULL,
	"request" text,
	"summary" text NOT NULL,
	"changes" text[] DEFAULT '{}'::text[] NOT NULL,
	"proposed" jsonb NOT NULL,
	"based_on_rating_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"status" "proposal_status" DEFAULT 'pending' NOT NULL,
	"created_by_member_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_revision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"snapshot" jsonb NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "family_settings" ADD COLUMN "dinner_time" text DEFAULT '18:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "family_settings" ADD COLUMN "autopilot_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "family_settings" ADD COLUMN "autopilot_day" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "family_settings" ADD COLUMN "reminders" jsonb DEFAULT '{"thaw":true,"start":true,"rate":true,"autopilot":true,"proposals":true}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe" ADD COLUMN "nutrition" jsonb;--> statement-breakpoint
ALTER TABLE "week_plan" ADD COLUMN "autopilot_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_proposal" ADD CONSTRAINT "recipe_proposal_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_proposal" ADD CONSTRAINT "recipe_proposal_created_by_member_id_member_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_revision" ADD CONSTRAINT "recipe_revision_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipe_proposal_recipe_idx" ON "recipe_proposal" USING btree ("recipe_id","status");