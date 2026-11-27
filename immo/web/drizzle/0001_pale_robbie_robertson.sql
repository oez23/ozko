ALTER TABLE "buyer_requests" ALTER COLUMN "currency" SET DEFAULT 'TRY';--> statement-breakpoint
ALTER TABLE "properties" ALTER COLUMN "currency" SET DEFAULT 'TRY';--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "living_rooms" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;