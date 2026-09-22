CREATE TABLE "restaurant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"cuisine" text NOT NULL,
	"area" text,
	"website" text,
	"phone" text,
	"notes" text,
	"research" jsonb,
	"researched_at" timestamp with time zone,
	"research_error" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "planned_meal" ADD COLUMN "restaurant_id" uuid;--> statement-breakpoint
ALTER TABLE "planned_meal" ADD CONSTRAINT "planned_meal_restaurant_id_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant"("id") ON DELETE set null ON UPDATE no action;