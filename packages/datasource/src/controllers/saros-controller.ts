import assert from "assert";
import { format } from "util";
import type z from "zod/mini";
import Decimal from "decimal.js";
import { inArray } from "drizzle-orm";
import { init } from "@rhiva-ag/decoder/programs/saros/index";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { web3, type IdlAccounts, type IdlEvents } from "@coral-xyz/anchor";
import type { LiquidityBook } from "@rhiva-ag/decoder/programs/idls/types/saros";
import {
  AccountLayout,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  chunkFetchMultipleAccountInfo,
  collectionToMap,
  collectMap,
} from "@rhiva-ag/shared";
import {
  createSwap,
  getPairs,
  pairs,
  mints,
  upsertMint,
  type Database,
  type pairInsertSchema,
  type pairSelectSchema,
  type mintSelectSchema,
} from "@rhiva-ag/datasource";

import { cacheResult } from "../instances";
import { getMultiplePrices } from "./price-controller";
import { BN } from "bn.js";

export const transformSarosPairAccount = ({
  binStep,
  staticFeeParameters,
  dynamicFeeParameters,
  tokenMintX,
  tokenMintY,
}: IdlAccounts<LiquidityBook>["pair"]): Omit<
  z.infer<typeof pairInsertSchema>,
  "id" | "name"
> => {
  const baseFee = (staticFeeParameters.baseFactor * binStep) / 1e6;
  const variableFee =
    staticFeeParameters.variableFeeControl > 0
      ? (Math.pow(dynamicFeeParameters.volatilityAccumulator * binStep, 2) *
          staticFeeParameters.variableFeeControl) /
        1e6
      : 0;

  const dynamicFee = Math.max(baseFee, variableFee);
  const protocolFee = dynamicFee * (staticFeeParameters.protocolShare / 1e4);

  return {
    baseFee,
    dynamicFee,
    protocolFee,
    extra: {},
    liquidity: 0,
    market: "saros",
    maxFee: baseFee,
    binStep: binStep,
    baseReserveAmountUsd: 0,
    quoteReserveAmountUsd: 0,
    baseMint: tokenMintX.toBase58(),
    quoteMint: tokenMintY.toBase58(),
  };
};

export const upsertSarosPair = async (
  db: Database,
  connection: web3.Connection,
  ...pairIds: string[]
) => {
  const [program] = init(connection);
  const umi = createUmi(connection.rpcEndpoint);
  const allPairs = await getPairs(db, inArray(pairs.id, pairIds));
  const nonExistingPairPubKeys = pairIds
    .map((pairId) => new web3.PublicKey(pairId))
    .filter(
      (pairId) =>
        !allPairs.some((pair) => new web3.PublicKey(pair.id).equals(pairId)),
    );

  if (nonExistingPairPubKeys.length > 0) {
    const pairAccounts = await program.account.pair.fetchMultiple(
      nonExistingPairPubKeys,
    );
    const pairAccountsWithPubKeys = collectMap(
      pairAccounts,
      (pairAccount, index) => {
        const pubkey = nonExistingPairPubKeys[index];
        if (pairAccount) return { pubkey, ...pairAccount };

        return null;
      },
    );

    const mints = await upsertMint(
      db,
      umi,
      ...pairAccountsWithPubKeys.flatMap((pair) => [
        pair.tokenMintX.toBase58(),
        pair.tokenMintY.toBase58(),
      ]),
    );

    const values: Pick<
      z.infer<typeof pairInsertSchema>,
      "id" | "name" | "market" | "baseMint" | "quoteMint" | "extra"
    >[] = pairAccountsWithPubKeys.map((pairAccount) => {
      const pairMints = mints.filter(
        (mint) =>
          pairAccount.tokenMintX.equals(new web3.PublicKey(mint.id)) ||
          pairAccount.tokenMintY.equals(new web3.PublicKey(mint.id)),
      );

      return {
        extra: {},
        market: "saros",
        id: pairAccount.pubkey.toBase58(),
        baseMint: pairAccount.tokenMintX.toBase58(),
        quoteMint: pairAccount.tokenMintY.toBase58(),
        name: pairMints.map((mint) => mint.symbol).join("/"),
      };
    });

    const syncedPairs = await syncSarosPairs(
      db,
      connection,
      values,
      pairAccounts,
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
          liquidity: pairs.liquidity,
          dynamicFee: pairs.dynamicFee,
          protocolFee: pairs.protocolFee,
          baseReserveAmountUsd: pairs.baseReserveAmountUsd,
          quoteReserveAmountUsd: pairs.quoteReserveAmountUsd,
        },
      })
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

export const createSarosSwap = async (
  db: Database,
  connection: web3.Connection,
  signature: string,
  ...values: IdlEvents<LiquidityBook>["binSwapEvent"][]
) => {
  assert(values.length > 0, "expect values > 0");

  const pairIds = values.map((value) => value.pair.toBase58());

  const pairs = await cacheResult(
    async (pairIds) => upsertSarosPair(db, connection, ...pairIds),
    ...pairIds,
  );

  return createSwap(
    db,
    pairs,
    getMultiplePrices,
    ...values.map((value, index) => {
      const pair = pairs.find((pair) =>
        value.pair.equals(new web3.PublicKey(pair.id)),
      );
      assert(
        pair,
        format(
          "pair %s not created for swap %s",
          value.pair.toBase58(),
          signature,
        ),
      );
      const baseAmount = value.swapForY ? value.amountIn : value.amountOut;
      const quoteAmount = value.swapForY ? value.amountOut : value.amountIn;

      const [feeX, feeY] = value.swapForY
        ? [value.fee, new BN(0)]
        : [new BN(0), value.fee];

      return {
        signature,
        extra: {},
        tvl: pair.liquidity,
        instructionIndex: index,
        pair: value.pair.toBase58(),
        type: value.swapForY ? ("sell" as const) : ("buy" as const),
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

export async function syncSarosPairs(
  db: Database,
  connection: web3.Connection,
  allPairs: Pick<z.infer<typeof pairSelectSchema>, "id">[],
  pairAccounts?: (IdlAccounts<LiquidityBook>["pair"] | null)[],
  allPairMints?: Pick<
    z.infer<typeof mintSelectSchema>,
    "id" | "decimals" | "tokenProgram"
  >[],
) {
  const [program] = init(connection);
  assert(allPairs.length < 101, "maximum pairs that can be synced once is 101");
  pairAccounts = pairAccounts
    ? pairAccounts
    : await program.account.pair.fetchMultiple(allPairs.map((pair) => pair.id));

  const mintIds = collectMap(pairAccounts, (pair) =>
    pair ? [pair.tokenMintX.toBase58(), pair.tokenMintY.toBase58()] : null,
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
        const mintX = pairMints.get(pairAccount.tokenMintX.toBase58());
        const mintY = pairMints.get(pairAccount.tokenMintY.toBase58());

        assert(mintX && mintY, "mintX and mintY required.");

        const tokenXVault = getAssociatedTokenAddressSync(
          pairAccount.tokenMintX,
          pubkey,
          true,
          new web3.PublicKey(mintX.tokenProgram),
        );
        const tokenYVault = getAssociatedTokenAddressSync(
          pairAccount.tokenMintY,
          pubkey,
          true,
          new web3.PublicKey(mintY.tokenProgram),
        );
        return {
          ...pairAccount,
          pubkey,
          mintX,
          mintY,
          tokenXVault,
          tokenYVault,
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
      pair.tokenXVault,
      pair.tokenYVault,
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
      const tokenXPrice = prices[pair.tokenMintX.toBase58()];
      const tokenYPrice = prices[pair.tokenMintY.toBase58()];

      const tokenXVaultAccountInfo = tokenAccounts.get(
        pair.tokenXVault.toBase58(),
      );
      const tokenYVaultAccountInfo = tokenAccounts.get(
        pair.tokenYVault.toBase58(),
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
        const transformedPairAccount = transformSarosPairAccount(pair);

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
