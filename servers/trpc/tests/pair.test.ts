import { and } from "drizzle-orm";
import { describe, test, expect } from "bun:test";
import {
  buildDrizzleWhereClauseFromObject,
  buildOrderByClauseFromObject,
} from "@rhiva-ag/datasource";

import { db } from "../src/instances";
import { getAggregratedPairs } from "../src/routes/pairs/pair.controller";
import {
  pairFilterSchema,
  pairOrderBySchema,
} from "../src/routes/pairs/pair.schema";

describe("pair.controller", () => {
  test("should pass pair aggregrate", async () => {
    const where = buildDrizzleWhereClauseFromObject(
      pairFilterSchema.partial().parse({
        market: { eq: "saros" },
      }),
    );

    const orderBy = buildOrderByClauseFromObject(
      pairOrderBySchema.parse(["H24SwapsVolumeUsd"]),
    );
    const pairs = await getAggregratedPairs(db, {
      where: and(...where),
      orderBy,
    });

    console.log(pairs);
    expect(pairs).toBeArray();
  });
});
