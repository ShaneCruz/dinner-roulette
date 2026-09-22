CREATE TABLE "rating" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planned_meal_id" uuid NOT NULL,
	"recipe_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"entered_by_member_id" uuid,
	"stars" integer NOT NULL,
	"reasons" text[] DEFAULT '{}'::text[] NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rating_stars_range" CHECK ("rating"."stars" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "planned_meal" ADD COLUMN "favored_member_id" uuid;--> statement-breakpoint
ALTER TABLE "planned_meal" ADD COLUMN "suggestion_reason" text;--> statement-breakpoint
ALTER TABLE "rating" ADD CONSTRAINT "rating_planned_meal_id_planned_meal_id_fk" FOREIGN KEY ("planned_meal_id") REFERENCES "public"."planned_meal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating" ADD CONSTRAINT "rating_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating" ADD CONSTRAINT "rating_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating" ADD CONSTRAINT "rating_entered_by_member_id_member_id_fk" FOREIGN KEY ("entered_by_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rating_meal_member_idx" ON "rating" USING btree ("planned_meal_id","member_id");--> statement-breakpoint
CREATE INDEX "rating_recipe_idx" ON "rating" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "rating_member_idx" ON "rating" USING btree ("member_id");--> statement-breakpoint
ALTER TABLE "planned_meal" ADD CONSTRAINT "planned_meal_favored_member_id_member_id_fk" FOREIGN KEY ("favored_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;