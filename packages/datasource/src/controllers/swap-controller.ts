import assert from "assert";
import { format } from "util";
import type z from "zod/mini";

import type { getPairs } from "./pair-controller";
import { swaps, type Database, type swapInsertSchema } from "../db";

export const createSwap = async (
  db: Database,
  pairs: Awaited<ReturnType<typeof getPairs>>,
  getMultiplePrices: (
    mints: string[],
  ) => Promise<Record<string, { price: number }>>,
  ...values: (Omit<
    z.infer<typeof swapInsertSchema>,
    "baseAmountUsd" | "quoteAmountUsd" | "feeUsd"
  > & { feeX: number; feeY: number; baseAmount: number; quoteAmount: number })[]
) => {
  const mints = pairs.flatMap((pair) => [pair.baseMint.id, pair.quoteMint.id]);
  const prices = await getMultiplePrices(mints);

  return db
    .insert(swaps)
    .values(
      values.map((value) => {
        const pair = pairs.find((pair) => pair.id === value.pair);
        assert(
          pair,
          format("missing pair %s for swap %s", value.pair, value.signature),
        );

        const basePrice = prices[pair.baseMint.id];
        const quotePrice = prices[pair.quoteMint.id];

        assert(basePrice, "fail to fetch basePrice");
        assert(quotePrice, "fail to fetch quotePrice");

        return {
          ...value,
          feeUsd: basePrice.price * value.feeX + quotePrice.price * value.feeY,
          baseAmountUsd: basePrice.price * value.baseAmount,
          quoteAmountUsd: quotePrice.price * value.quoteAmount,
        };
      }),
    )
    .onConflictDoNothing({ target: [swaps.signature, swaps.instructionIndex] })
    .returning();
};
