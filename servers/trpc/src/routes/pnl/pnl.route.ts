import z from "zod";
import { TRPCError } from "@trpc/server";

import { pnlSchema } from "./pnl.schema";
import { getSarosPNL } from "../../utils/pnl";
import { publicProcedure, router } from "../../trpc";

export const pnlRoute = router({
  retrieve: publicProcedure
    .input(
      z.object({
        market: z.enum(["saros"]),
        signature: z.string().min(88),
      }),
    )
    .output(pnlSchema.nullish())
    .query(async ({ ctx, input }) => {
      if (input.market === "saros")
        return getSarosPNL(
          ctx.solanaConnection,
          ctx.coingecko,
          ctx.solanatracker,
          input.signature,
        );

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "market type not supported.",
      });
    }),
});
