import { relations } from "drizzle-orm";

import { pairs } from "./pairs";
import { mints } from "./mints";

export const mintRelations = relations(mints, ({ many }) => ({
  pairs: many(pairs),
}));

export const pairRelations = relations(pairs, ({ one }) => ({
  base_token: one(mints, {
    references: [mints.address],
    fields: [pairs.base_token],
  }),
  quote_token: one(mints, {
    references: [mints.address],
    fields: [pairs.quote_token],
  }),
}));
