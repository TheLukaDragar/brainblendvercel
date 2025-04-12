-- First convert to a temporary column of the correct type
ALTER TABLE "ExpertRequest" ADD COLUMN "tags_array" text[] DEFAULT '{}';--> statement-breakpoint
-- Copy data with conversion (JSON array to text array)
UPDATE "ExpertRequest" SET "tags_array" = ARRAY(SELECT jsonb_array_elements_text(tags::jsonb));--> statement-breakpoint
-- Drop the old column
ALTER TABLE "ExpertRequest" DROP COLUMN "tags";--> statement-breakpoint
-- Rename the new column to the original name
ALTER TABLE "ExpertRequest" RENAME COLUMN "tags_array" TO "tags";--> statement-breakpoint
-- Set constraints on the new column
ALTER TABLE "ExpertRequest" ALTER COLUMN "tags" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "ExpertRequest" ALTER COLUMN "tags" SET NOT NULL;