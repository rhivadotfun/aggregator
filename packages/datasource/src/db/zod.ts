import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { mints, pairs } from "./schema";

export const mintInsertSchema = createInsertSchema(mints);
export const mintSelectSchema = createSelectSchema(mints);

export const pairInsertSchema = createInsertSchema(pairs);
export const pairSelectSchema = createSelectSchema(pairs, {
  base_token: mintSelectSchema,
  quote_token: mintSelectSchema,
});
