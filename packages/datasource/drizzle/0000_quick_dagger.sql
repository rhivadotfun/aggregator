CREATE TABLE "mints" (
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"address" text PRIMARY KEY NOT NULL,
	"image_url" text NOT NULL,
	"decimals" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pairs" (
	"name" text NOT NULL,
	"market" text NOT NULL,
	"address" text PRIMARY KEY NOT NULL,
	"fees24h" double precision NOT NULL,
	"bin_step" integer NOT NULL,
	"reserve_in_usd" double precision NOT NULL,
	"extra" jsonb NOT NULL,
	"fdv_usd" double precision NOT NULL,
	"market_cap_usd" double precision NOT NULL,
	"pool_created_at" timestamp with time zone NOT NULL,
	"base_token" text NOT NULL,
	"quote_token" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pairs" ADD CONSTRAINT "pairs_base_token_mints_address_fk" FOREIGN KEY ("base_token") REFERENCES "public"."mints"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairs" ADD CONSTRAINT "pairs_quote_token_mints_address_fk" FOREIGN KEY ("quote_token") REFERENCES "public"."mints"("address") ON DELETE no action ON UPDATE no action;