CREATE TABLE IF NOT EXISTS "ExpertAssignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expertRequestId" uuid NOT NULL,
	"expertId" uuid NOT NULL,
	"status" varchar DEFAULT 'assigned' NOT NULL,
	"response" text,
	"rating" varchar,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ExpertRequest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatId" uuid NOT NULL,
	"question" text NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"assignedExpertsCount" integer
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ExpertAssignment" ADD CONSTRAINT "ExpertAssignment_expertRequestId_ExpertRequest_id_fk" FOREIGN KEY ("expertRequestId") REFERENCES "public"."ExpertRequest"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ExpertAssignment" ADD CONSTRAINT "ExpertAssignment_expertId_User_id_fk" FOREIGN KEY ("expertId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ExpertRequest" ADD CONSTRAINT "ExpertRequest_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
