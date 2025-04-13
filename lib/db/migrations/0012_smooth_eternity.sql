-- First, create a temp column for rating to handle the type conversion
ALTER TABLE "ExpertAssignment" ADD COLUMN IF NOT EXISTS "rating_new" integer;--> statement-breakpoint
UPDATE "ExpertAssignment" SET "rating_new" = 
  CASE 
    WHEN "rating" IS NULL THEN NULL
    WHEN "rating" ~ E'^\\d+$' THEN "rating"::integer
    ELSE NULL
  END;--> statement-breakpoint
ALTER TABLE "ExpertAssignment" DROP COLUMN IF EXISTS "rating";--> statement-breakpoint
ALTER TABLE "ExpertAssignment" RENAME COLUMN "rating_new" TO "rating";--> statement-breakpoint

-- Only add columns if they don't exist
ALTER TABLE "Chat" ADD COLUMN IF NOT EXISTS "expertiseTags" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "ExpertAssignment" ADD COLUMN IF NOT EXISTS "creditsAwarded" integer;--> statement-breakpoint
ALTER TABLE "ExpertRequest" ADD COLUMN IF NOT EXISTS "title" text DEFAULT 'Untitled';--> statement-breakpoint
ALTER TABLE "ExpertRequest" ADD COLUMN IF NOT EXISTS "expertiseTags" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "ExpertRequest" ADD COLUMN IF NOT EXISTS "completedExpertsCount" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "expertiseTagsEmbedding" json DEFAULT 'null'::json;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "credits" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "xp" integer DEFAULT 0 NOT NULL;