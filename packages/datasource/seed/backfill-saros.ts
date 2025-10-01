import type z from "zod";
import type { DexApi } from "@rhiva-ag/dex-api";
import { SPL_TOKEN_PROGRAM_ID } from "@metaplex-foundation/mpl-toolbox";
import {
  type pairInsertSchema,
  pairs,
  type Database,
  mints,
  type mintInsertSchema,
} from "../src";

export const seedSaros = async (db: Database, api: DexApi) => {
  const pools = (await api.saros.pool.list()).data;
  await db
    .insert(mints)
    .values(
      pools.data
        .flatMap((pool) => [pool.tokenX, pool.tokenY])
        .map(
          (mint): z.infer<typeof mintInsertSchema> => ({
            id: mint.mintAddress,
            symbol: mint.symbol,
            name: mint.name,
            decimals: mint.decimals,
            tokenProgram: SPL_TOKEN_PROGRAM_ID,
            extra: {
              uri: mint.image,
              metadata: {
                image: mint.image,
              },
            },
          }),
        ),
    )
    .onConflictDoNothing({ target: [mints.id] })
    .execute();

  await db
    .insert(pairs)
    .values(
      pools.data
        .flatMap((pool) => pool.pairs)
        .flat()
        .map((pool): z.infer<typeof pairInsertSchema> => {
          const baseFee = (pool.binStep * pool.baseFactor) / 1e6;

          return {
            baseFee,
            id: pool.pair,
            market: "meteora",
            extra: {},
            maxFee: baseFee,
            dynamicFee: baseFee,
            binStep: pool.binStep,
            protocolFee: baseFee * 0.2,
            baseMint: pool.tokenX.mintAddress,
            quoteMint: pool.tokenY.mintAddress,
            liquidity: parseFloat(pool.totalLiquidity),
            baseReserveAmountUsd: parseFloat(pool.reserveX),
            quoteReserveAmountUsd: parseFloat(pool.reserveY),
            name: [pool.tokenX.symbol, pool.tokenY.symbol].join("/"),
          };
        }),
    )
    .onConflictDoUpdate({
      target: [pairs.id],
      set: {
        name: pairs.name,
        liquidity: pairs.liquidity,
        baseReserveAmountUsd: pairs.baseReserveAmountUsd,
        quoteReserveAmountUsd: pairs.quoteReserveAmountUsd,
      },
    })
    .execute();
};
