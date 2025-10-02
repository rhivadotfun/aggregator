import assert from "assert";
import { format } from "util";
import type z from "zod/mini";
import Decimal from "decimal.js";
import { inArray } from "drizzle-orm";
import { AccountLayout } from "@solana/spl-token";
import type { Umi } from "@metaplex-foundation/umi";
import { init } from "@rhiva-ag/decoder/programs/raydium/index";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { web3, type IdlAccounts, type IdlEvents } from "@coral-xyz/anchor";
import type { AmmV3 } from "@rhiva-ag/decoder/programs/idls/types/raydium";
import {
  chunkFetchMultipleAccountInfo,
  collectionToMap,
  collectMap,
} from "@rhiva-ag/shared";
import {
  createSwap,
  getPairs,
  mints,
  type mintSelectSchema,
  pairs,
  type pairSelectSchema,
  rewardMints,
  upsertMint,
  type Database,
  type pairInsertSchema,
} from "@rhiva-ag/datasource";

import { cacheResult } from "../instances";
import { getMultiplePrices } from "./price-controller";

export const transformRaydiumPairAccount = (
  poolState: IdlAccounts<AmmV3>["poolState"],
  ammConfig: IdlAccounts<AmmV3>["ammConfig"],
): Omit<z.infer<typeof pairInsertSchema>, "id" | "name"> & {
  rewardMints: string[];
} => {
  const baseFee = (ammConfig.tradeFeeRate * ammConfig.tickSpacing) / 1e4;
  const protocolFee = baseFee * (ammConfig.protocolFeeRate / 1e6);

  return {
    extra: {
      tokenVault0: poolState.tokenVault0.toBase58(),
      tokenVault1: poolState.tokenVault1.toBase58(),
    },
    baseFee,
    protocolFee,
    maxFee: baseFee,
    liquidity: 0,
    dynamicFee: 0,
    baseReserveAmountUsd: 0,
    quoteReserveAmountUsd: 0,
    market: "raydium" as const,
    binStep: poolState.tickSpacing,
    baseMint: poolState.tokenMint0.toBase58(),
    quoteMint: poolState.tokenMint1.toBase58(),
    rewardMints: poolState.rewardInfos
      .filter(
        (rewardInfo) =>
          !rewardInfo.tokenMint.equals(web3.SystemProgram.programId),
      )
      .map((rewardInfo) => rewardInfo.tokenMint.toBase58()),
  };
};

const upsertRaydiumPair = async (
  db: Database,
  umi: Umi,
  connection: web3.Connection,
  ...pairIds: string[]
) => {
  const [program] = init(connection);
  const allPairs = await getPairs(db, inArray(pairs.id, pairIds));
  const nonExistingPairPubKeys = pairIds
    .map((pairId) => new web3.PublicKey(pairId))
    .filter(
      (pairId) =>
        !allPairs.some((pair) => new web3.PublicKey(pair.id).equals(pairId)),
    );

  if (nonExistingPairPubKeys.length > 0) {
    const poolStates = await program.account.poolState.fetchMultiple(
      nonExistingPairPubKeys,
    );
    const poolStatesWithPubkeys = collectMap(poolStates, (poolState, index) => {
      const pubkey = nonExistingPairPubKeys[index];
      if (poolState)
        return {
          pubkey,
          ...poolState,
        };

      return null;
    });

    const ammConfigPubkeys = poolStatesWithPubkeys.map(
      (poolState) => poolState.ammConfig,
    );

    const ammConfigs = collectMap(
      await program.account.ammConfig.fetchMultiple(ammConfigPubkeys),
      (ammConfig, index) => {
        if (ammConfig) {
          const pubkey = poolStatesWithPubkeys[index].ammConfig;
          return { ...ammConfig, pubkey };
        }

        return null;
      },
    );

    const ammConfigMaps = collectionToMap(ammConfigs, (ammConfig) =>
      ammConfig.pubkey.toBase58(),
    );

    const mints = await upsertMint(
      db,
      umi,
      ...poolStates
        .filter((pool) => !!pool)
        .flatMap((pool) => [
          pool.tokenMint0.toBase58(),
          pool.tokenMint1.toBase58(),
          ...pool.rewardInfos
            .filter(
              (rewardInfo) =>
                !rewardInfo.tokenMint.equals(web3.SystemProgram.programId),
            )
            .map((reward) => reward.tokenMint.toBase58()),
        ]),
    );

    const values: (z.infer<typeof pairInsertSchema> & {
      rewardMints: string[];
    })[] = collectMap(poolStatesWithPubkeys, (poolState) => {
      const ammConfig = ammConfigMaps.get(poolState.ammConfig.toBase58());
      const poolMints = mints.filter(
        (mint) =>
          poolState.tokenMint0.equals(new web3.PublicKey(mint.id)) ||
          poolState.tokenMint1.equals(new web3.PublicKey(mint.id)),
      );

      if (ammConfig)
        return {
          id: poolState.pubkey.toBase58(),
          name: poolMints.map((mint) => mint.symbol).join("/"),
          ...transformRaydiumPairAccount(poolState, ammConfig),
        };

      return null;
    });

    const syncedPairs = await syncRaydiumPairs(
      db,
      connection,
      values,
      poolStates,
      ammConfigs,
      mints,
    );
    const createdPairs = await db
      .insert(pairs)
      .values(
        syncedPairs.map((pair) => {
          const value = values.find((value) => value.id === pair.id)!;
          return { ...pair, ...value };
        }),
      )
      .returning({ id: pairs.id })
      .onConflictDoUpdate({
        target: [pairs.id],
        set: {
          maxFee: pairs.maxFee,
          binStep: pairs.binStep,
          baseFee: pairs.baseFee,
          dynamicFee: pairs.dynamicFee,
          protocolFee: pairs.protocolFee,
          liquidity: pairs.liquidity,
          baseReserveAmountUsd: pairs.baseReserveAmountUsd,
          quoteReserveAmountUsd: pairs.quoteReserveAmountUsd,
        },
      })
      .execute();

    const rewards = values
      .filter((value) => value.rewardMints.length > 0)
      .flatMap((value) =>
        value.rewardMints.map((mint) => ({ mint, pair: value.id })),
      );

    if (rewards.length > 0)
      await db
        .insert(rewardMints)
        .values(rewards)
        .onConflictDoNothing({ target: [rewardMints.pair, rewardMints.mint] })
        .execute();

    allPairs.push(
      ...(await getPairs(
        db,
        inArray(
          pairs.id,
          createdPairs.map((pair) => pair.id),
        ),
      )),
    );
  }

  return allPairs;
};

export const createRaydiumV3Swap = async (
  db: Database,
  connection: web3.Connection,
  signature: string,
  ...swapEvents: IdlEvents<AmmV3>["swapEvent"][]
) => {
  assert(swapEvents.length > 0, "expect swapEvents > 0");

  const umi = createUmi(connection.rpcEndpoint);
  const pairIds = swapEvents.map((swapEvent) => swapEvent.poolState.toBase58());

  const pairs = await cacheResult(
    async (pairIds) => upsertRaydiumPair(db, umi, connection, ...pairIds),
    ...pairIds,
  );

  return createSwap(
    db,
    pairs,
    getMultiplePrices,
    ...swapEvents.map((swapEvent, index) => {
      const pair = pairs.find((pair) =>
        swapEvent.poolState.equals(new web3.PublicKey(pair.id)),
      );
      assert(
        pair,
        format(
          "pair %s not created for swap %s",
          swapEvent.poolState.toBase58(),
          signature,
        ),
      );

      const baseAmount = swapEvent.zeroForOne
        ? swapEvent.amount1
        : swapEvent.amount0;
      const quoteAmount = swapEvent.zeroForOne
        ? swapEvent.amount0
        : swapEvent.amount1;

      const [feeX, feeY] = swapEvent.zeroForOne
        ? [swapEvent.transferFee0, swapEvent.transferFee1]
        : [swapEvent.transferFee1, swapEvent.transferFee0];

      return {
        signature,
        extra: {},
        tvl: pair.liquidity,
        instructionIndex: index,
        pair: swapEvent.poolState.toBase58(),
        type: swapEvent.zeroForOne ? ("sell" as const) : ("buy" as const),
        feeX: new Decimal(feeX.toString())
          .div(Math.pow(10, pair.baseMint.decimals))
          .toNumber(),
        feeY: new Decimal(feeY.toString())
          .div(Math.pow(10, pair.quoteMint.decimals))
          .toNumber(),
        baseAmount: new Decimal(baseAmount.toString())
          .div(Math.pow(10, pair.baseMint.decimals))
          .toNumber(),
        quoteAmount: new Decimal(quoteAmount.toString())
          .div(Math.pow(10, pair.quoteMint.decimals))
          .toNumber(),
      };
    }),
  );
};

export async function syncRaydiumPairs(
  db: Database,
  connection: web3.Connection,
  allPairs: Pick<z.infer<typeof pairSelectSchema>, "id">[],
  pairAccounts?: (IdlAccounts<AmmV3>["poolState"] | null)[],
  allAmmConfigs?: (IdlAccounts<AmmV3>["ammConfig"] | null)[],
  allPairMints?: Pick<
    z.infer<typeof mintSelectSchema>,
    "id" | "decimals" | "tokenProgram"
  >[],
) {
  const [program] = init(connection);
  assert(allPairs.length < 101, "maximum pairs that can be synced once is 101");
  pairAccounts = pairAccounts
    ? pairAccounts
    : await program.account.poolState.fetchMultiple(
        allPairs.map((pair) => pair.id),
      );

  const mintIds = collectMap(pairAccounts, (pair) =>
    pair ? [pair.tokenMint0.toBase58(), pair.tokenMint1.toBase58()] : null,
  ).flat();

  const purePairAccountWithPubkeys = collectMap(
    pairAccounts,
    (pairAccount, index) => {
      const pubkey = allPairs[index].id;
      if (pairAccount)
        return { ...pairAccount, pubkey: new web3.PublicKey(pubkey) };

      return null;
    },
  );
  const ammConfigs = collectionToMap(
    collectMap(
      allAmmConfigs
        ? allAmmConfigs
        : await program.account.ammConfig.fetchMultiple(
            purePairAccountWithPubkeys.map(
              (pairAccount) => pairAccount.ammConfig,
            ),
          ),
      (ammConfig, index) => {
        const pairAccount = purePairAccountWithPubkeys[index];
        if (ammConfig) return { ...ammConfig, pubkey: pairAccount.ammConfig };
        return null;
      },
    ),
    (ammConfig) => ammConfig.pubkey.toBase58(),
  );

  const pairMints = collectionToMap(
    allPairMints
      ? allPairMints
      : await db.query.mints.findMany({
          where: inArray(mints.id, mintIds),
          columns: {
            id: true,
            decimals: true,
            tokenProgram: true,
          },
        }),
    (item) => item.id,
  );
  const pairAccountWithPubkeys = collectMap(
    pairAccounts,
    (pairAccount, index) => {
      if (pairAccount) {
        const pubkey = new web3.PublicKey(allPairs[index].id);
        const mintX = pairMints.get(pairAccount.tokenMint0.toBase58());
        const mintY = pairMints.get(pairAccount.tokenMint1.toBase58());
        const ammConfigAccount = ammConfigs.get(
          pairAccount.ammConfig.toBase58(),
        );

        assert(ammConfigAccount, "ammConfig required");
        assert(mintX && mintY, "mintX and mintY required.");

        return {
          ...pairAccount,
          pubkey,
          mintX,
          mintY,
          ammConfigAccount,
        };
      }

      return null;
    },
  );

  const tokenAccounts = await chunkFetchMultipleAccountInfo(
    connection.getMultipleAccountsInfo.bind(connection),
    101,
  )(
    pairAccountWithPubkeys.flatMap((pair) => [
      pair.tokenVault0,
      pair.tokenVault1,
    ]),
  );

  const prices = await getMultiplePrices(mintIds);

  const updates = collectMap(
    pairAccountWithPubkeys,
    (
      pair,
    ): (Partial<z.infer<typeof pairInsertSchema>> & { id: string }) | null => {
      const tokenXPrice = prices[pair.tokenMint0.toBase58()];
      const tokenYPrice = prices[pair.tokenMint1.toBase58()];

      const tokenXVaultAccountInfo = tokenAccounts.get(
        pair.tokenVault0.toBase58(),
      );
      const tokenYVaultAccountInfo = tokenAccounts.get(
        pair.tokenVault1.toBase58(),
      );

      if (tokenXVaultAccountInfo && tokenYVaultAccountInfo) {
        const tokenXVaultAccount = AccountLayout.decode(
          tokenXVaultAccountInfo.data,
        );
        const tokenYVaultAccount = AccountLayout.decode(
          tokenYVaultAccountInfo.data,
        );

        const baseReserveAmount = new Decimal(tokenXVaultAccount.amount)
          .div(Math.pow(10, pair.mintX.decimals))
          .toNumber();
        const quoteReserveAmount = new Decimal(tokenYVaultAccount.amount)
          .div(Math.pow(10, pair.mintY.decimals))
          .toNumber();
        const baseReserveAmountUsd = baseReserveAmount * tokenXPrice.price;
        const quoteReserveAmountUsd = quoteReserveAmount * tokenYPrice.price;

        const transformedPairAccount = transformRaydiumPairAccount(
          pair,
          pair.ammConfigAccount,
        );

        if (tokenXPrice && tokenYPrice) {
          return {
            syncAt: new Date(),
            baseReserveAmountUsd,
            quoteReserveAmountUsd,
            id: pair.pubkey.toBase58(),
            baseFee: transformedPairAccount.baseFee,
            maxFee: transformedPairAccount.maxFee,
            binStep: transformedPairAccount.binStep,
            dynamicFee: transformedPairAccount.dynamicFee,
            protocolFee: transformedPairAccount.protocolFee,
            liquidity: baseReserveAmountUsd + quoteReserveAmountUsd,
          };
        }
      }

      return null;
    },
  );

  return updates;
}
