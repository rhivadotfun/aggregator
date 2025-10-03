import type { z } from "zod/mini";
import { and, or } from "drizzle-orm";
import { describe, test, expect } from "bun:test";
import { buildDrizzleWhereClauseFromObject } from "@rhiva-ag/datasource";

import { db } from "../src/instances";
import { getPairs } from "../src/routes/pairs/pair.controller";
import type {
  pairFilterSchema,
  pairSearchSchema,
} from "../src/routes/pairs/pair.schema";

describe("pair.controller", () => {
  test("should pass getSarosPools", async () => {
    const where: Partial<z.infer<typeof pairFilterSchema>> = {
      market: { eq: "saros" },
    };

    const search: Partial<z.infer<typeof pairSearchSchema>> = {
      name: { ilike: "" },
    };

    const pools = await getPairs(db, {
      where: and(
        ...buildDrizzleWhereClauseFromObject(where),
        or(...buildDrizzleWhereClauseFromObject(search)),
      ),
    });

    expect(pools).toBeArray();
    for (const pool of pools) {
      expect(pool).toContainKeys([
        "base_token",
        "quote_token",
        "bin_step",
        "reserve_in_usd",
        "market_cap_usd",
        "fees24h",
      ]);
    }
  });
});
