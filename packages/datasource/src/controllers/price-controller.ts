import xior from "xior";
import { format } from "util";

import { cacheResult, coingecko, solanatracker } from "../instances";
import type { PriceTimestampData } from "@solana-tracker/data-api";

export const priceFallback = async (mints: string[]) => {
  const response = await xior.get<{ prices: Record<string, number> }>(
    format(
      "https://fe-api.jup.ag/api/v1/prices?list_address=%s",
      mints.join(","),
    ),
  );
  return Object.entries(response.data.prices).map(([key, price]) => ({
    id: key,
    price,
    lastUpdated: Date.now(),
  }));
};

export const getMultiplePrices = async (
  mints: string[],
): Promise<Record<string, { price: number }>> => {
  const prices = await cacheResult(
    async (mints) => {
      const prices: { id: string; price: number }[] = await priceFallback(
        mints,
      ).catch(() => []);
      let unloaded: string[] =
        prices.length > 0
          ? prices.filter((price) => price.price <= 0).map((price) => price.id)
          : mints;

      if (unloaded.length > 0) {
        const geckoPrices =
          await coingecko.onchain.networks.tokens.multi.getAddresses(
            unloaded.join(","),
            { network: "solana" },
          );
        if (geckoPrices.data)
          for (const price of geckoPrices.data)
            if (price.id && price.attributes?.price_usd) {
              prices.push({
                id: price.id,
                price: parseFloat(price.attributes.price_usd),
              });
              unloaded = unloaded.filter((id) => id !== price.id);
            }
      }

      if (unloaded.length > 0)
        prices.push(
          ...(await solanatracker.getMultiplePrices(unloaded).then((value) =>
            Object.entries(value).map(([key, price]) => ({
              id: key,
              ...price,
            })),
          )),
        );

      return prices;
    },
    ...mints,
  );
  return Object.fromEntries(
    prices.map((price) => [price.id, { price: price.price }]),
  );
};

export const getMultiplePriceByTimestamp = async (
  mints: string[],
  timestamp: number,
): Promise<Record<string, PriceTimestampData>> => {
  if (mints.length > 0) {
    const prices = await Promise.all(
      mints.map((mint) => solanatracker.getPriceAtTimestamp(mint, timestamp)),
    );
    const priceEntries = prices.map((price, index) => {
      const mint = mints[index];
      return [mint, price];
    });

    return Object.fromEntries(priceEntries);
  }

  return {};
};
