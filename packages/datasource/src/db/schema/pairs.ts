import {
  doublePrecision,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { mints } from "./mints";

type Extra = Record<string, unknown>;

export const pairs = pgTable("pairs", {
  id: text().primaryKey(),
  name: text().notNull(),
  extra: jsonb().$type<Extra>().notNull(),
  quoteMint: text()
    .references(() => mints.id)
    .notNull(),
  baseMint: text()
    .references(() => mints.id)
    .notNull(),
  binStep: doublePrecision().notNull(),
  baseFee: doublePrecision().notNull(),
  maxFee: doublePrecision().notNull(),
  protocolFee: doublePrecision().notNull(),
  dynamicFee: doublePrecision().notNull(),
  liquidity: doublePrecision().notNull(),
  baseReserveAmountUsd: doublePrecision().notNull(),
  quoteReserveAmountUsd: doublePrecision().notNull(),
  syncAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  market: text({ enum: ["meteora", "orca", "raydium", "saros"] }).notNull(),
});

export const pairAggregrates = pgTable("pairAggregates", {
  pair: text()
    .references(() => pairs.id)
    .notNull(),
  end: timestamp({ withTimezone: true }).notNull(),
  start: timestamp({ withTimezone: true }).notNull(),
  fee: doublePrecision().notNull(),
  buyVolume: doublePrecision().notNull(),
  sellVolume: doublePrecision().notNull(),
  price: doublePrecision().notNull(),
});
