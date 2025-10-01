import Decimal from "decimal.js";
import { collectMap } from "@rhiva-ag/shared";
import { BN, type web3 } from "@coral-xyz/anchor";
import { Pipeline, type ProgramEventType } from "@rhiva-ag/decoder";
import type { LiquidityBook } from "@rhiva-ag/decoder/programs/idls/types/saros";
import {
  getMultiplePriceByTimestamp,
  upsertSarosPair,
  type Database,
} from "@rhiva-ag/datasource";
import {
  SarosProgramEventProcessor,
  SarosProgramInstructionEventProcessor,
} from "@rhiva-ag/decoder/programs/saros/index";

import { cacheResult } from "../instances";

export const getSarosPNL = async (
  db: Database,
  connection: web3.Connection,
  value: string,
) => {
  const pairAndPosition = await new Promise<
    [web3.PublicKey, web3.PublicKey] | null
  >((resolve, reject) => {
    const consumer = async (events: ProgramEventType<LiquidityBook>[]) => {
      for (const event of events) {
        if (event.name === "positionCreationEvent")
          return resolve([event.data.pair, event.data.position]);
        if (event.name === "positionDecreaseEvent")
          return resolve([event.data.pair, event.data.position]);
        return resolve(null);
      }
    };

    const pipeline = new Pipeline([
      new SarosProgramEventProcessor(connection).addConsumer(consumer),
      new SarosProgramInstructionEventProcessor(connection).addConsumer(
        (instructions) =>
          consumer(instructions.map((instruction) => instruction.parsed)),
      ),
    ]);

    return connection
      .getParsedTransaction(value, { maxSupportedTransactionVersion: 0 })
      .then(async (transaction) => {
        if (transaction)
          return pipeline
            .process(transaction)
            .finally(() => resolve(null))
            .catch(reject);

        return resolve(null);
      })
      .catch(reject);
  });

  if (pairAndPosition) {
    let openTime: number = Date.now();
    let closeTime: number = Date.now();
    const [pairPubkey, position] = pairAndPosition;
    let beforeBaseAmount = new BN(0),
      beforeQuoteAmount = new BN(0),
      afterBaseAmount = new BN(0),
      afterQuoteAmount = new BN(0);
    const poolIds = [pairPubkey.toBase58()];
    const [pair] = await cacheResult(
      (poolIds) => upsertSarosPair(db, connection, ...poolIds),
      ...poolIds,
    );

    const confirmSignatureInfos =
      await connection.getSignaturesForAddress(position);
    const consumer = async (
      events: ProgramEventType<LiquidityBook>[],
      { blockTime }: { blockTime?: number | null },
    ) => {
      for (const event of events) {
        if (event.name === "positionIncreaseEvent") {
          beforeBaseAmount = event.data.amountsX.reduce(
            (acc, cur) => acc.add(cur),
            beforeBaseAmount,
          );
          beforeQuoteAmount = event.data.amountsY.reduce(
            (acc, cur) => acc.add(cur),
            beforeQuoteAmount,
          );
          if (blockTime) openTime = blockTime;
        }

        if (event.name === "positionDecreaseEvent") {
          afterBaseAmount = event.data.amountsX.reduce(
            (acc, cur) => acc.add(cur),
            afterBaseAmount,
          );
          afterQuoteAmount = event.data.amountsY.reduce(
            (acc, cur) => acc.add(cur),
            afterQuoteAmount,
          );

          if (blockTime) closeTime = blockTime;
        }
      }
    };

    const pipeline = new Pipeline([
      new SarosProgramEventProcessor(connection).addConsumer(consumer),
      new SarosProgramInstructionEventProcessor(connection).addConsumer(
        (instructions, extra) =>
          consumer(
            instructions.map((instruction) => instruction.parsed),
            extra,
          ),
      ),
    ]);

    const signatures = collectMap(confirmSignatureInfos, (signature) =>
      signature.err ? null : signature,
    );

    const parsedTransactions = collectMap(
      await connection.getParsedTransactions(
        signatures.map((signature) => signature.signature),
        { maxSupportedTransactionVersion: 0 },
      ),
      (parsedTransaction) => parsedTransaction,
    );

    await pipeline.process(...parsedTransactions);

    const openBaseAmount = new Decimal(beforeBaseAmount.toString())
      .div(Math.pow(10, pair.baseMint.decimals))
      .toNumber();
    const openQuoteAmount = new Decimal(beforeQuoteAmount.toString())
      .div(Math.pow(10, pair.quoteMint.decimals))
      .toNumber();
    const closeBaseAmount = new Decimal(afterBaseAmount.toString())
      .div(Math.pow(10, pair.baseMint.decimals))
      .toNumber();
    const closeQuoteAmount = new Decimal(afterQuoteAmount.toString())
      .div(Math.pow(10, pair.quoteMint.decimals))
      .toNumber();

    const openMints: string[] = [];
    if (openBaseAmount > 0) openMints.push(pair.baseMint.id);
    if (openQuoteAmount > 0) openMints.push(pair.quoteMint.id);

    const closeMints: string[] = [];
    if (closeBaseAmount > 0) closeMints.push(pair.baseMint.id);
    if (closeQuoteAmount > 0) closeMints.push(pair.quoteMint.id);

    const openPrices = await getMultiplePriceByTimestamp(openMints, openTime);
    const closePrices = await getMultiplePriceByTimestamp(
      closeMints,
      closeTime,
    );

    const baseMintOpenPrice = openPrices[pair.baseMint.id];
    const quoteMintOpenPrice = openPrices[pair.quoteMint.id];
    const baseMintClosePrice = closePrices[pair.baseMint.id];
    const quoteMintClosePrice = closePrices[pair.quoteMint.id];

    const openBaseAmountUsd = baseMintOpenPrice
      ? baseMintOpenPrice.price * openBaseAmount
      : 0;
    const openQuoteAmountUsd = quoteMintOpenPrice
      ? quoteMintOpenPrice.price * openQuoteAmount
      : 0;
    const closeBaseAmountUsd = baseMintClosePrice
      ? baseMintClosePrice.price * closeBaseAmount
      : 0;
    const closeQuoteAmountUsd = quoteMintClosePrice
      ? quoteMintClosePrice.price * closeQuoteAmount
      : 0;

    const openAmount = openBaseAmountUsd + openQuoteAmountUsd;
    const closeAmount = closeBaseAmountUsd + closeQuoteAmountUsd;
    let pnl = 0;
    const delta = closeAmount - openAmount;
    if (openAmount === 0) pnl = closeAmount === 0 ? 0 : 100;
    else pnl = (delta / openAmount) * 100;

    return {
      pnl,
      delta,
      openAmount,
      closeAmount,
      name: pair.name,
      duration: closeTime - openTime,
      tvl: openAmount,
    };
  }

  return null;
};
