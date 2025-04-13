ALTER TABLE "ExpertRequest" ADD COLUMN IF NOT EXISTS "expertiseTags" JSONB DEFAULT '[]'::jsonb; 
