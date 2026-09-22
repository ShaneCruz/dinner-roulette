CREATE TYPE "public"."idea_status" AS ENUM('pending', 'rejected', 'writing', 'added', 'failed');--> statement-breakpoint
CREATE TABLE "recipe_idea" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"emoji" text DEFAULT '🍽️' NOT NULL,
	"cuisine" text NOT NULL,
	"active_minutes" integer NOT NULL,
	"total_minutes" integer NOT NULL,
	"health_category" text NOT NULL,
	"spice_level" integer DEFAULT 0 NOT NULL,
	"kid_appeal" text,
	"twist_on" text,
	"status" "idea_status" DEFAULT 'pending' NOT NULL,
	"recipe_id" uuid,
	"decided_by_member_id" uuid,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipe_idea" ADD CONSTRAINT "recipe_idea_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_idea" ADD CONSTRAINT "recipe_idea_decided_by_member_id_member_id_fk" FOREIGN KEY ("decided_by_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipe_idea_status_idx" ON "recipe_idea" USING btree ("status","created_at");