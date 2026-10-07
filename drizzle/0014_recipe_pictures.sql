CREATE TABLE "recipe_photo" (
	"recipe_id" uuid PRIMARY KEY NOT NULL,
	"content_type" text NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipe" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "recipe" ADD COLUMN "photo_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "recipe_photo" ADD CONSTRAINT "recipe_photo_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE cascade ON UPDATE no action;