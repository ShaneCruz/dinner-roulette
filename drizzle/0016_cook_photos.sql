CREATE TABLE "cook_photo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"planned_meal_id" uuid,
	"member_id" uuid,
	"made_on" date NOT NULL,
	"caption" text,
	"content_type" text NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cook_photo" ADD CONSTRAINT "cook_photo_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_photo" ADD CONSTRAINT "cook_photo_planned_meal_id_planned_meal_id_fk" FOREIGN KEY ("planned_meal_id") REFERENCES "public"."planned_meal"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_photo" ADD CONSTRAINT "cook_photo_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cook_photo_recipe_idx" ON "cook_photo" USING btree ("recipe_id","made_on");