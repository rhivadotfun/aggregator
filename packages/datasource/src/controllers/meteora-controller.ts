import BN from "bn.js";
import assert from "assert";
import { format } from "util";
import type z from "zod/mini";
import Decimal from "decimal.js";
import { inArray } from "drizzle-orm";
import { AccountLayout } from "@solana/spl-token";
import type { Umi } from "@metaplex-foundation/umi";
import { init } from "@rhiva-ag/decoder/programs/meteora/index";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { web3, type IdlAccounts, type IdlEvents } from "@coral-xyz/anchor";
import type { LbClmm } from "@rhiva-ag/decoder/programs/idls/types/meteora";
import {
  chunkFetchMultipleAccountInfo,
  collectionToMap,
  collectMap,
} from "@rhiva-ag/shared";
import {
  createSwap,
  getPairs,
  mints,
  pairs,
  rewardMints,
  upsertMint,
  type Database,
  type mintSelectSchema,
  type pairInsertSchema,
  type pairSelectSchema,
} from "@rhiva-ag/datasource";

import { cacheResult } from "../instances";
import { getMultiplePrices } from "./price-controller";

export const transformMeteoraPairAccount = ({
  binStep,
  parameters,
  vParameters,
  tokenXMint,
  tokenYMint,
  rewardInfos,
}: IdlAccounts<LbClmm>["lbPair"]): Omit<
  z.infer<typeof pairInsertSchema>,
  "id" | "name"
> & { rewardMints: string[] } => {
  const baseFee = (parameters.baseFactor * binStep) / 1e6;
  const variableFee =
    parameters.variableFeeControl > 0
      ? (Math.pow(vParameters.volatilityAccumulator * binStep, 2) *
          parameters.variableFeeControl) /
        1e11
      : 0;

  const dynamicFee = Math.max(baseFee, variableFee);
  const protocolFee = dynamicFee * (parameters.protocolShare / 1e4);

  return {
    baseFee,
    dynamicFee,
    protocolFee,
    binStep,
    extra: {},
    liquidity: 0,
    maxFee: 10,
    market: "meteora",
    baseReserveAmountUsd: 0,
    quoteReserveAmountUsd: 0,
    baseMint: tokenXMint.toBase58(),
    quoteMint: tokenYMint.toBase58(),
    rewardMints: rewardInfos
      .filter(
        (rewardInfo) => !rewardInfo.mint.equals(web3.SystemProgram.programId),
      )
      .map((rewardInfo) => rewardInfo.mint.toBase58()),
  };
};

const upsertMeteoraPair = async (
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
    const lbPairs = await program.account.lbPair.fetchMultiple(
      nonExistingPairPubKeys,
    );
    const lbPairsWithPubkeys = collectMap(lbPairs, (lbPair, index) => {
      const pubkey = nonExistingPairPubKeys[index];
      if (lbPair) return { pubkey, ...lbPair };
      return null;
    });

    const mints = await upsertMint(
      db,
      umi,
      ...lbPairsWithPubkeys.flatMap((lbPair) => [
        lbPair.tokenXMint.toBase58(),
        lbPair.tokenYMint.toBase58(),
        ...lbPair.rewardInfos
          .filter(
            (rewardInfo) =>
              !rewardInfo.mint.equals(web3.SystemProgram.programId),
          )
          .map((reward) => reward.mint.toBase58()),
      ]),
    );

    const values: (z.infer<typeof pairInsertSchema> & {
      rewardMints: string[];
    })[] = await Promise.all(
      lbPairsWithPubkeys.map(async (lbPair) => {
        const poolMints = mints.filter(
          (mint) =>
            lbPair.tokenXMint.equals(new web3.PublicKey(mint.id)) ||
            lbPair.tokenYMint.equals(new web3.PublicKey(mint.id)),
        );

        return {
          id: lbPair.pubkey.toBase58(),
          name: poolMints.map((mint) => mint.symbol).join("/"),
          ...transformMeteoraPairAccount(lbPair),
        };
      }),
    );
    const syncedPairs = await syncMeteoraPairs(
      db,
      connection,
      values,
      lbPairs,
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

export const createMeteoraSwap = async (
  db: Database,
  connection: web3.Connection,
  signature: string,
  ...swapEvents: IdlEvents<LbClmm>["swap"][]
) => {
  assert(swapEvents.length > 0, "expect swapEvents > 0");

  const umi = createUmi(connection.rpcEndpoint);
  const pairIds = swapEvents.map((swapEvent) => swapEvent.lbPair.toBase58());

  const pairs = await cacheResult(
    async (pairIds) => upsertMeteoraPair(db, umi, connection, ...pairIds),
    ...pairIds,
  );

  return createSwap(
    db,
    pairs,
    getMultiplePrices,
    ...swapEvents.map((swapEvent, index) => {
      const pair = pairs.find((pair) =>
        swapEvent.lbPair.equals(new web3.PublicKey(pair.id)),
      );
      assert(
        pair,
        format(
          "pair %s not created for swap %s",
          swapEvent.lbPair.toBase58(),
          signature,
        ),
      );

      const baseAmount = swapEvent.swapForY
        ? swapEvent.amountIn
        : swapEvent.amountOut;
      const quoteAmount = swapEvent.swapForY
        ? swapEvent.amountOut
        : swapEvent.amountIn;
      const [feeX, feeY] = swapEvent.swapForY
        ? [swapEvent.fee, new BN(0)]
        : [new BN(0), swapEvent.fee];

      return {
        signature,
        extra: {},
        tvl: pair.liquidity,
        instructionIndex: index,
        pair: swapEvent.lbPair.toBase58(),
        type: swapEvent.swapForY ? ("sell" as const) : ("buy" as const),
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

export async function syncMeteoraPairs(
  db: Database,
  connection: web3.Connection,
  allPairs: Pick<z.infer<typeof pairSelectSchema>, "id">[],
  pairAccounts?: (IdlAccounts<LbClmm>["lbPair"] | null)[],
  allPairMints?: Pick<
    z.infer<typeof mintSelectSchema>,
    "id" | "decimals" | "tokenProgram"
  >[],
) {
  const [program] = init(connection);
  assert(allPairs.length < 101, "maximum pairs that can be synced once is 101");
  pairAccounts = pairAccounts
    ? pairAccounts
    : await program.account.lbPair.fetchMultiple(
        allPairs.map((pair) => pair.id),
      );

  const mintIds = collectMap(pairAccounts, (pair) =>
    pair ? [pair.tokenXMint.toBase58(), pair.tokenYMint.toBase58()] : null,
  ).flat();

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
        const mintX = pairMints.get(pairAccount.tokenXMint.toBase58());
        const mintY = pairMints.get(pairAccount.tokenYMint.toBase58());

        assert(mintX && mintY, "mintX and mintY required.");

        return {
          ...pairAccount,
          pubkey,
          mintX,
          mintY,
        };
      }

      return null;
    },
  );

  const tokenAccounts = await chunkFetchMultipleAccountInfo(
    connection.getMultipleAccountsInfo.bind(connection),
    101,
  )(pairAccountWithPubkeys.flatMap((pair) => [pair.reserveX, pair.reserveY]));

  const prices = await getMultiplePrices(mintIds);

  const updates = collectMap(
    pairAccountWithPubkeys,
    (
      pair,
    ): (Partial<z.infer<typeof pairInsertSchema>> & { id: string }) | null => {
      const tokenXPrice = prices[pair.tokenXMint.toBase58()];
      const tokenYPrice = prices[pair.tokenYMint.toBase58()];
      const tokenXVaultAccountInfo = tokenAccounts.get(
        pair.reserveX.toBase58(),
      );
      const tokenYVaultAccountInfo = tokenAccounts.get(
        pair.reserveY.toBase58(),
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

        const transformedPairAccount = transformMeteoraPairAccount(pair);

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
