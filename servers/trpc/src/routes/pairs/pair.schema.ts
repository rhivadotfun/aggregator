import z from "zod";
import {
  orderByOperator,
  pairSelectSchema,
  whereOperator,
} from "@rhiva-ag/datasource";

export const pairFilterSchema = z.object({
  bin_step: whereOperator(z.number()),
  fdv_usd: whereOperator(z.number()),
  market_cap_usd: whereOperator(z.number()),
  reserve_in_usd: whereOperator(z.number()),
  market: whereOperator(pairSelectSchema.shape.market),
});

export const pairSearchSchema = z.object({
  name: whereOperator(z.string()),
  address: whereOperator(z.string()),
});

export const pairOrderBySchema = orderByOperator(
  z.enum(["fdv_usd", "market_cap_usd", "reserve_in_usd", "fees24h"]),
);
