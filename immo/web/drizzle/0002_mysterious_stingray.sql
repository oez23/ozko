CREATE TABLE "match_dismissals" (
	"request_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_dismissals_request_id_property_id_pk" PRIMARY KEY("request_id","property_id")
);
--> statement-breakpoint
CREATE TABLE "shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"contact_id" uuid,
	"token_hash" text NOT NULL,
	"property_ids" uuid[] NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "buyer_requests" ADD COLUMN "shared_with_network" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "shared_with_network" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "matches_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "match_dismissals" ADD CONSTRAINT "match_dismissals_request_id_buyer_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."buyer_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_dismissals" ADD CONSTRAINT "match_dismissals_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_dismissals" ADD CONSTRAINT "match_dismissals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shares_token_key" ON "shares" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "shares_contact_idx" ON "shares" USING btree ("org_id","contact_id");--> statement-breakpoint
CREATE INDEX "properties_network_idx" ON "properties" USING btree ("deal_type","city_key") WHERE "properties"."shared_with_network" and "properties"."status" = 'active';