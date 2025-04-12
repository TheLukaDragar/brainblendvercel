ALTER TABLE "ExpertRequest" ALTER COLUMN "tags" SET DATA TYPE text[];--> statement-breakpoint
ALTER TABLE "ExpertRequest" ALTER COLUMN "tags" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "ExpertRequest" ALTER COLUMN "tags" SET NOT NULL;