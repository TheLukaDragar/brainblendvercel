CREATE TABLE IF NOT EXISTS "ExpertRequest" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "chatId" UUID NOT NULL REFERENCES "Chat"("id"),
  "question" TEXT NOT NULL,
  "status" VARCHAR NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL,
  "assignedExpertsCount" INTEGER
);

CREATE TABLE IF NOT EXISTS "ExpertAssignment" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "expertRequestId" UUID NOT NULL REFERENCES "ExpertRequest"("id"),
  "expertId" UUID NOT NULL REFERENCES "User"("id"),
  "status" VARCHAR NOT NULL DEFAULT 'assigned',
  "response" TEXT,
  "rating" VARCHAR,
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL
); 