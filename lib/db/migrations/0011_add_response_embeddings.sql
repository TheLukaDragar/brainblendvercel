-- Add responseEmbedding column to ExpertAssignment table
ALTER TABLE "ExpertAssignment" 
ADD COLUMN IF NOT EXISTS "responseEmbedding" JSONB DEFAULT NULL;

-- Add an index to speed up queries that filter on status
CREATE INDEX IF NOT EXISTS "ExpertAssignment_status_idx" ON "ExpertAssignment" ("status"); 