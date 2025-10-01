import {
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { pairs } from "./pairs";

type Extra = Record<string, never>;

export const swaps = pgTable(
  "swaps",
  {
    signature: text(),
    instructionIndex: integer().notNull(),
    extra: jsonb().$type<Extra>().notNull(),
    type: text({ enum: ["sell", "buy"] }).notNull(),
    pair: text()
      .references(() => pairs.id, { onDelete: "cascade" })
      .notNull(),
    tvl: doublePrecision(),
    price: doublePrecision(),
    feeUsd: doublePrecision().notNull(),
    baseAmountUsd: doublePrecision().notNull(),
    quoteAmountUsd: doublePrecision().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (column) => [unique().on(column.signature, column.instructionIndex)],
);
