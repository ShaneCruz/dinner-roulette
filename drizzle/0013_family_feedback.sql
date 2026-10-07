ALTER TABLE "family_settings" ALTER COLUMN "autopilot_enabled" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "family_settings" ADD COLUMN "usual_servings" integer;--> statement-breakpoint
ALTER TABLE "family_settings" ADD COLUMN "cook_nights_per_week" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
-- The family asked for a blank week unless they ask the planner to fill it.
UPDATE "family_settings" SET "autopilot_enabled" = false;