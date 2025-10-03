import z from "zod";
import { and, or } from "drizzle-orm";
import {
  buildDrizzleWhereClauseFromObject,
  buildOrderByClauseFromObject,
} from "@rhiva-ag/datasource";

import { getPairs } from "./pair.controller";
import { publicProcedure, router } from "../../trpc";
import {
  pairFilterSchema,
  pairOrderBySchema,
  pairSearchSchema,
} from "./pair.schema";

export const pairRoute = router({
  list: publicProcedure
    .input(
      z
        .object({
          limit: z.number(),
          offset: z.number(),
        })
        .extend({
          orderBy: pairOrderBySchema.optional(),
          filter: pairFilterSchema.partial().optional(),
          search: pairSearchSchema.partial().optional(),
        }),
    )
    .query(async ({ ctx, input }) => {
      const where = [];
      const orderBy = [];

      if (input.filter)
        where.push(and(...buildDrizzleWhereClauseFromObject(input.filter)));
      if (input.search)
        where.push(or(...buildDrizzleWhereClauseFromObject(input.search)));
      if (input.orderBy)
        orderBy.push(...buildOrderByClauseFromObject(input.orderBy));

      return getPairs(ctx.drizzle, { where: and(...where), orderBy });
    }),
});
