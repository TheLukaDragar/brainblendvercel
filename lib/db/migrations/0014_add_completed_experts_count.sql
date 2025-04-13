-- Add completedExpertsCount column to ExpertRequest table
ALTER TABLE "ExpertRequest" ADD COLUMN IF NOT EXISTS "completedExpertsCount" INTEGER DEFAULT 0;

-- Calculate initial values based on submitted assignments
UPDATE "ExpertRequest" er 
SET "completedExpertsCount" = (
  SELECT COUNT(*) 
  FROM "ExpertAssignment" ea 
  WHERE ea."expertRequestId" = er.id AND ea.status = 'submitted'
); 