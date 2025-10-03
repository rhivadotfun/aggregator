import {
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { mints } from "./mints";

type Transaction = {
  buys: number;
  sells: number;
  buyers: number;
  sellers: number;
};

type Extra = {
  price_change_percentage: {
    m5: number;
    m15: number;
    m30: number;
    h1: number;
    h6: number;
    h24: number;
  };
  transactions: {
    m5: Transaction;
    m15: Transaction;
    m30: Transaction;
    h1: Transaction;
    h6: Transaction;
    h24: Transaction;
  };
  volume_usd: {
    m5: number;
    m15: number;
    m30: number;
    h1: number;
    h6: number;
    h24: number;
  };
};

export const pairs = pgTable("pairs", {
  name: text().notNull(),
  market: text({ enum: ["saros"] }).notNull(),
  address: text().primaryKey(),
  fees24h: doublePrecision().notNull(),
  base_fee: doublePrecision().notNull(),
  bin_step: integer().notNull(),
  reserve_in_usd: doublePrecision().notNull(),
  extra: jsonb().$type<Extra>().notNull(),
  fdv_usd: doublePrecision().notNull(),
  market_cap_usd: doublePrecision().notNull(),
  pool_created_at: timestamp({ withTimezone: true }).notNull(),
  base_token: text()
    .references(() => mints.address)
    .notNull(),
  quote_token: text()
    .references(() => mints.address)
    .notNull(),
});
