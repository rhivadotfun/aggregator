import { integer, pgTable, text } from "drizzle-orm/pg-core";

export const mints = pgTable("mints", {
  name: text().notNull(),
  symbol: text().notNull(),
  address: text().primaryKey(),
  image_url: text().notNull(),
  decimals: integer().notNull(),
});
