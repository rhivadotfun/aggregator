CREATE TABLE "mints" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"symbol" text,
	"decimals" integer NOT NULL,
	"extra" jsonb NOT NULL,
	"tokenProgram" text NOT NULL,
	"syncAt" timestamp with time zone DEFAULT now() NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pairAggregates" (
	"pair" text NOT NULL,
	"end" timestamp with time zone NOT NULL,
	"start" timestamp with time zone NOT NULL,
	"fee" double precision NOT NULL,
	"buyVolume" double precision NOT NULL,
	"sellVolume" double precision NOT NULL,
	"price" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pairs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"extra" jsonb NOT NULL,
	"quoteMint" text NOT NULL,
	"baseMint" text NOT NULL,
	"binStep" double precision NOT NULL,
	"baseFee" double precision NOT NULL,
	"maxFee" double precision NOT NULL,
	"protocolFee" double precision NOT NULL,
	"dynamicFee" double precision NOT NULL,
	"liquidity" double precision NOT NULL,
	"baseReserveAmountUsd" double precision NOT NULL,
	"quoteReserveAmountUsd" double precision NOT NULL,
	"syncAt" timestamp with time zone DEFAULT now() NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"market" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "swaps" (
	"signature" text,
	"instructionIndex" integer NOT NULL,
	"extra" jsonb NOT NULL,
	"type" text NOT NULL,
	"pair" text NOT NULL,
	"tvl" double precision,
	"price" double precision,
	"feeUsd" double precision NOT NULL,
	"baseAmountUsd" double precision NOT NULL,
	"quoteAmountUsd" double precision NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "swaps_signature_instructionIndex_unique" UNIQUE("signature","instructionIndex")
);
--> statement-breakpoint
CREATE TABLE "rewardMints" (
	"pair" text NOT NULL,
	"mint" text NOT NULL,
	CONSTRAINT "rewardMints_pair_mint_unique" UNIQUE NULLS NOT DISTINCT("pair","mint")
);
--> statement-breakpoint
ALTER TABLE "pairAggregates" ADD CONSTRAINT "pairAggregates_pair_pairs_id_fk" FOREIGN KEY ("pair") REFERENCES "public"."pairs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairs" ADD CONSTRAINT "pairs_quoteMint_mints_id_fk" FOREIGN KEY ("quoteMint") REFERENCES "public"."mints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairs" ADD CONSTRAINT "pairs_baseMint_mints_id_fk" FOREIGN KEY ("baseMint") REFERENCES "public"."mints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swaps" ADD CONSTRAINT "swaps_pair_pairs_id_fk" FOREIGN KEY ("pair") REFERENCES "public"."pairs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewardMints" ADD CONSTRAINT "rewardMints_pair_pairs_id_fk" FOREIGN KEY ("pair") REFERENCES "public"."pairs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewardMints" ADD CONSTRAINT "rewardMints_mint_mints_id_fk" FOREIGN KEY ("mint") REFERENCES "public"."mints"("id") ON DELETE cascade ON UPDATE no action;