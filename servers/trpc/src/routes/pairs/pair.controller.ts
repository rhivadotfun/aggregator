import type { SQL } from "drizzle-orm";
import type { Database } from "@rhiva-ag/datasource";

export async function getPairs(
  db: Database,
  options?: {
    limit?: number;
    offset?: number;
    where?: SQL<unknown>;
    orderBy?: SQL<unknown>[];
  },
) {
  const query = db.query.pairs.findMany({
    ...options,
    with: {
      base_token: true,
      quote_token: true,
    },
    columns: {
      base_token: false,
      quote_token: false,
    },
  });
  console.log(query.toSQL().sql);

  return query.execute();
}
