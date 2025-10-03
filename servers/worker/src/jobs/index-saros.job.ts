import type z from "zod";
import chunk from "lodash.chunk";
import type { DexApi } from "@rhiva-ag/dex-api";
import { collectionToMap } from "@rhiva-ag/shared";
import type Coingecko from "@coingecko/coingecko-typescript";
import {
  mints,
  pairs,
  type Database,
  type mintInsertSchema,
  type pairInsertSchema,
} from "@rhiva-ag/datasource";

import { parseNumber } from "../utils/parse-number";
import { transformCoingeckoPools } from "../utils/transform-coingecko-data";

export const indexSaros = async (
  db: Database,
  dexApi: DexApi,
  coingecko: Coingecko,
) => {
  let page = 1;
  let limit = 20;

  while (true) {
    const {
      data: { data, total },
    } = await dexApi.saros.pool.list(page);
    if (page === 1) limit = data.length;

    const allPairs = data.flatMap(({ pairs }) => pairs);
    console.log("pairs to index=", allPairs.length, "page=", page);
    const pairIds = chunk(
      allPairs.map(({ pair }) => pair),
      50,
    );
    const coingeckoPools = transformCoingeckoPools(
      ...(await Promise.all(
        pairIds.map((pairIds) =>
          coingecko.onchain.networks.pools.multi.getAddresses(
            pairIds.join(","),
            {
              network: "solana",
            },
          ),
        ),
      )),
    );
    console.log("coin indexed", coingeckoPools.length);
    const mapPairs = collectionToMap(allPairs, ({ pair }) =>
      pair.toLowerCase(),
    );
    const createPoolData = new Map<string, z.infer<typeof pairInsertSchema>>();
    const createMintData = new Map<string, z.infer<typeof mintInsertSchema>>();

    for (const pool of coingeckoPools) {
      const pair = mapPairs.get(pool.address.toLowerCase())!;
      const base_fee = (pair.baseFactor * pair.binStep) / 1e6;

      createPoolData.set(pool.address, {
        base_fee,
        market: "saros",
        name: pool.name,
        address: pool.address,
        bin_step: pair.binStep,
        fdv_usd: parseNumber(pool.fdv_usd),
        base_token: pair.tokenX.address,
        quote_token: pair.tokenY.address,
        fees24h: parseNumber(pair.fees24h),
        market_cap_usd: parseNumber(pool.market_cap_usd),
        pool_created_at: new Date(pool.pool_created_at),
        reserve_in_usd: parseNumber(pool.reserve_in_usd),
        extra: {
          transactions: {
            m5: {
              sells: parseNumber(pool.transactions.m5?.sells),
              buys: parseNumber(pool.transactions.m5?.buys),
              buyers: parseNumber(pool.transactions.m5?.buyers),
              sellers: parseNumber(pool.transactions.m5?.sellers),
            },
            m15: {
              sells: parseNumber(pool.transactions.m15?.sells),
              buys: parseNumber(pool.transactions.m15?.buys),
              buyers: parseNumber(pool.transactions.m15?.buyers),
              sellers: parseNumber(pool.transactions.m15?.sellers),
            },
            m30: {
              sells: parseNumber(pool.transactions.m30?.sells),
              buys: parseNumber(pool.transactions.m30?.buys),
              buyers: parseNumber(pool.transactions.m30?.buyers),
              sellers: parseNumber(pool.transactions.m30?.sellers),
            },
            h1: {
              sells: parseNumber(pool.transactions.h1?.sells),
              buys: parseNumber(pool.transactions.h1?.buyers),
              buyers: parseNumber(pool.transactions.h1?.buyers),
              sellers: parseNumber(pool.transactions.h1?.sellers),
            },
            h6: {
              sells: parseNumber(pool.transactions.h6?.sells),
              buys: parseNumber(pool.transactions.h6?.buys),
              buyers: parseNumber(pool.transactions.h6?.buyers),
              sellers: parseNumber(pool.transactions.h6?.sellers),
            },
            h24: {
              sells: parseNumber(pool.transactions.h24?.sells),
              buys: parseNumber(pool.transactions.h24?.buys),
              buyers: parseNumber(pool.transactions.h24?.buyers),
              sellers: parseNumber(pool.transactions.h24?.sellers),
            },
          },
          volume_usd: {
            m5: parseNumber(pool.volume_usd.m5),
            m15: parseNumber(pool.volume_usd.m15),
            m30: parseNumber(pool.volume_usd.m30),
            h1: parseNumber(pool.volume_usd.h1),
            h6: parseNumber(pool.volume_usd.h6),
            h24: parseNumber(pool.volume_usd.h24),
          },
          price_change_percentage: {
            m5: parseNumber(pool.price_change_percentage.m5),
            m15: parseNumber(pool.price_change_percentage.m15),
            m30: parseNumber(pool.price_change_percentage.m30),
            h1: parseNumber(pool.price_change_percentage.h1),
            h6: parseNumber(pool.price_change_percentage.h6),
            h24: parseNumber(pool.price_change_percentage.h24),
          },
        },
      });

      createMintData.set(pair.tokenX.address, {
        name: pair.tokenX.name,
        decimals: pair.tokenX.decimals,
        symbol: pair.tokenX.symbol,
        address: pair.tokenX.address,
        image_url: pair.tokenX.image,
      });

      createMintData.set(pair.tokenY.address, {
        name: pair.tokenY.name,
        symbol: pair.tokenY.symbol,
        decimals: pair.tokenY.decimals,
        address: pair.tokenY.address,
        image_url: pair.tokenY.image,
      });
    }

    await db
      .insert(mints)
      .values(Array.from(createMintData.values()))
      .onConflictDoNothing({ target: mints.address });

    const updatePairs = Array.from(createPoolData.values());
    await db.transaction(async (db) =>
      Promise.all(
        updatePairs.map((pair) =>
          db
            .insert(pairs)
            .values(pair)
            .onConflictDoUpdate({ target: pairs.address, set: pair }),
        ),
      ),
    );
    if (page < Math.ceil(total / limit)) page += 1;
    else break;
  }
};
