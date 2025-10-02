import assert from "assert";
import { format } from "util";
import type z from "zod/mini";
import Decimal from "decimal.js";
import { inArray } from "drizzle-orm";
import { AccountLayout } from "@solana/spl-token";
import type { Umi } from "@metaplex-foundation/umi";
import { init } from "@rhiva-ag/decoder/programs/orca/index";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { web3, type IdlAccounts, type IdlEvents } from "@coral-xyz/anchor";
import type { Whirlpool } from "@rhiva-ag/decoder/programs/idls/types/orca";
import {
  chunkFetchMultipleAccountInfo,
  collectionToMap,
  collectMap,
} from "@rhiva-ag/shared";
import {
  createSwap,
  getPairs,
  pairs,
  upsertMint,
  rewardMints,
  type Database,
  type pairInsertSchema,
  type pairSelectSchema,
  type mintSelectSchema,
  mints,
} from "@rhiva-ag/datasource";

import { cacheResult } from "../instances";
import { getMultiplePrices } from "./price-controller";

export const transformOrcaPairAccount = (
  whirlpool: IdlAccounts<Whirlpool>["whirlpool"],
  oracle?: IdlAccounts<Whirlpool>["oracle"],
): Omit<z.infer<typeof pairInsertSchema>, "id" | "name"> & {
  rewardMints: string[];
} => {
  let dynamicFee = 0;
  const baseFee = whirlpool.feeRate / 1e6;
  const protocolFee = baseFee * (whirlpool.protocolFeeRate / 1e4);

  if (oracle) {
    const variableFee =
      oracle.adaptiveFeeConstants.adaptiveFeeControlFactor > 0
        ? (Math.pow(
            oracle.adaptiveFeeVariables.volatilityAccumulator *
              whirlpool.tickSpacing,
            2,
          ) *
            oracle.adaptiveFeeConstants.adaptiveFeeControlFactor) /
          1e6
        : 0;

    dynamicFee = Math.max(baseFee, variableFee);
  }

  return {
    extra: {},
    baseFee,
    protocolFee,
    maxFee: 10,
    liquidity: 0,
    dynamicFee,
    baseReserveAmountUsd: 0,
    quoteReserveAmountUsd: 0,
    market: "orca" as const,
    binStep: whirlpool.tickSpacing,
    baseMint: whirlpool.tokenMintA.toBase58(),
    quoteMint: whirlpool.tokenMintB.toBase58(),
    rewardMints: whirlpool.rewardInfos
      .filter(
        (rewardInfo) => !rewardInfo.mint.equals(web3.SystemProgram.programId),
      )
      .map((rewardInfo) => rewardInfo.mint.toBase58()),
  };
};

const upsertOrcaPair = async (
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
    const whirlpools = await program.account.whirlpool.fetchMultiple(
      nonExistingPairPubKeys,
    );

    const whirlpoolsWithPubkeys = collectMap(whirlpools, (whirlpool, index) => {
      const pubkey = nonExistingPairPubKeys[index];
      if (whirlpool) {
        const feeTierIndex =
          whirlpool.feeTierIndexSeed[0] + whirlpool.feeTierIndexSeed[1] * 256;

        if (whirlpool.tickSpacing === feeTierIndex)
          return { pubkey, oracle: null, ...whirlpool };

        const [pda] = web3.PublicKey.findProgramAddressSync(
          [Buffer.from("oracle"), pubkey.encode()],
          program.programId,
        );

        return { pubkey, oracle: pda, ...whirlpool };
      }
      return null;
    });

    const mints = await upsertMint(
      db,
      umi,
      ...whirlpoolsWithPubkeys.flatMap((whirlpool) => [
        whirlpool.tokenMintA.toBase58(),
        whirlpool.tokenMintB.toBase58(),
        ...whirlpool.rewardInfos
          .filter(
            (rewardInfo) =>
              !rewardInfo.mint.equals(web3.SystemProgram.programId),
          )
          .map((reward) => reward.mint.toBase58()),
      ]),
    );

    const values: (Pick<
      z.infer<typeof pairInsertSchema>,
      "id" | "name" | "market" | "baseMint" | "quoteMint" | "extra"
    > & { rewardMints: string[] })[] = whirlpoolsWithPubkeys.map(
      (whirlpool) => {
        const poolMints = mints.filter(
          (mint) =>
            whirlpool.tokenMintA.equals(new web3.PublicKey(mint.id)) ||
            whirlpool.tokenMintB.equals(new web3.PublicKey(mint.id)),
        );

        const rewardMints = whirlpool.rewardInfos
          .filter(
            (rewardInfo) =>
              !rewardInfo.mint.equals(web3.SystemProgram.programId),
          )
          .map((reward) => reward.mint.toBase58());

        return {
          extra: {},
          rewardMints,
          market: "orca",
          id: whirlpool.pubkey.toBase58(),
          baseMint: whirlpool.tokenMintA.toBase58(),
          quoteMint: whirlpool.tokenMintB.toBase58(),
          name: poolMints.map((mint) => mint.symbol).join("/"),
        };
      },
    );

    const syncedPairs = await syncOrcaPairs(
      db,
      connection,
      values,
      whirlpools,
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

export const createOrcaSwap = async (
  db: Database,
  connection: web3.Connection,
  signature: string,
  ...swapEvents: IdlEvents<Whirlpool>["traded"][]
) => {
  assert(swapEvents.length > 0, "expect swapEvents > 0");

  const umi = createUmi(connection.rpcEndpoint);
  const pairIds = swapEvents.map((swapEvent) => swapEvent.whirlpool.toBase58());
  const pairs = await cacheResult(
    async (pairIds) => upsertOrcaPair(db, umi, connection, ...pairIds),
    ...pairIds,
  );

  return createSwap(
    db,
    pairs,
    getMultiplePrices,
    ...swapEvents.map((swapEvent, index) => {
      const pair = pairs.find((pair) =>
        swapEvent.whirlpool.equals(new web3.PublicKey(pair.id)),
      );
      assert(
        pair,
        format(
          "pair %s not created for swap %s",
          swapEvent.whirlpool.toBase58(),
          signature,
        ),
      );

      const baseAmount = swapEvent.aToB
        ? swapEvent.inputAmount
        : swapEvent.outputAmount;
      const quoteAmount = swapEvent.aToB
        ? swapEvent.outputAmount
        : swapEvent.inputAmount;

      const [feeX, feeY] = swapEvent.aToB
        ? [swapEvent.inputTransferFee, swapEvent.outputTransferFee]
        : [swapEvent.outputTransferFee, swapEvent.inputTransferFee];

      return {
        signature,
        extra: {},
        tvl: pair.liquidity,
        instructionIndex: index,
        type: swapEvent.aToB ? ("sell" as const) : ("buy" as const),
        pair: swapEvent.whirlpool.toBase58(),
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

export async function syncOrcaPairs(
  db: Database,
  connection: web3.Connection,
  allPairs: Pick<z.infer<typeof pairSelectSchema>, "id">[],
  pairAccounts?: (IdlAccounts<Whirlpool>["whirlpool"] | null)[],
  allPairMints?: Pick<
    z.infer<typeof mintSelectSchema>,
    "id" | "decimals" | "tokenProgram"
  >[],
) {
  const [program] = init(connection);
  assert(allPairs.length < 101, "maximum pairs that can be synced once is 101");
  pairAccounts = pairAccounts
    ? pairAccounts
    : await program.account.whirlpool.fetchMultiple(
        allPairs.map((pair) => pair.id),
      );

  const mintIds = collectMap(pairAccounts, (pair) =>
    pair ? [pair.tokenMintA.toBase58(), pair.tokenMintB.toBase58()] : null,
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
        const mintX = pairMints.get(pairAccount.tokenMintA.toBase58());
        const mintY = pairMints.get(pairAccount.tokenMintB.toBase58());
        assert(mintX && mintY, "mintX and mintY required.");

        const feeTierIndex =
          pairAccount.feeTierIndexSeed[0] +
          pairAccount.feeTierIndexSeed[1] * 256;
        let oracle: web3.PublicKey | undefined;
        if (pairAccount.tickSpacing !== feeTierIndex)
          [oracle] = web3.PublicKey.findProgramAddressSync(
            [Buffer.from("oracle"), pubkey.encode()],
            program.programId,
          );

        return {
          ...pairAccount,
          oracle,
          pubkey,
          mintX,
          mintY,
        };
      }

      return null;
    },
  );

  let oracles: Map<string, IdlAccounts<Whirlpool>["oracle"]>;
  const whirlpoolsWithOracle = collectMap(
    pairAccountWithPubkeys,
    (whirlpool) => whirlpool.oracle,
  );

  if (whirlpoolsWithOracle.length > 0)
    oracles = collectionToMap(
      collectMap(
        await program.account.oracle.fetchMultiple(whirlpoolsWithOracle),
        (oracle, index) => {
          const pubkey = whirlpoolsWithOracle[index];
          if (oracle) return { pubkey, ...oracle };

          return null;
        },
      ),
      (oracle) => oracle.pubkey.toBase58(),
    );
  const tokenAccounts = await chunkFetchMultipleAccountInfo(
    connection.getMultipleAccountsInfo.bind(connection),
    101,
  )(
    pairAccountWithPubkeys.flatMap((pair) => [
      pair.tokenVaultA,
      pair.tokenVaultB,
    ]),
  );

  const prices = await getMultiplePrices(mintIds);
  const updates = collectMap(
    pairAccountWithPubkeys,
    (
      pair,
    ): Omit<
      z.infer<typeof pairInsertSchema>,
      "name" | "market" | "baseMint" | "quoteMint" | "extra"
    > | null => {
      const tokenXPrice = prices[pair.tokenMintA.toBase58()];
      const tokenYPrice = prices[pair.tokenMintB.toBase58()];
      const oracle = pair.oracle
        ? oracles.get(pair.oracle.toBase58())
        : undefined;
      const tokenXVaultAccountInfo = tokenAccounts.get(
        pair.tokenVaultA.toBase58(),
      );
      const tokenYVaultAccountInfo = tokenAccounts.get(
        pair.tokenVaultB.toBase58(),
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

        const transformedPairAccount = transformOrcaPairAccount(pair, oracle);

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
