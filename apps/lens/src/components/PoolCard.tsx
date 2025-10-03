import type z from "zod";
import Link from "next/link";
import { format } from "util";
import Image from "next/image";
import { useCallback, useMemo } from "react";
import type { pairSelectSchema } from "@rhiva-ag/datasource";

import Money from "./Money";
import Decimal from "./Decimal";
import BirdEye from "../assets/b.png";
import Photon from "../assets/ph.png";
import Saros from "../assets/saros.jpg";
import Jupiter from "../assets/jup.png";
import Dexscreener from "../assets/dex.png";

export default function PoolCard({
  pair,
}: {
  pair: z.infer<typeof pairSelectSchema>;
}) {
  const links = [
    {
      image: BirdEye,
      name: "birdeye",
      link: format(
        "https://birdeye.so/solana/token/%s/%s",
        pair.base_token.address,
        pair.address,
      ),
    },
    {
      image: Saros,
      name: "saros",
      link: format("https://dlmm.saros.xyz/pool/%s", pair.address),
    },
    {
      image: Dexscreener,
      name: "dexscreener",
      link: format("https://dexscreener.com/solana/%s", pair.address),
    },
    {
      image: Jupiter,
      name: "jupiter",
      link: format(
        "https://jup.ag/swap?sell=%s&buy=%s",
        pair.base_token.address,
        pair.quote_token.address,
      ),
    },
    {
      image: Photon,
      name: "photon",
      link: format("https://photon-sol.tinyastro.io/en/lp/%s", pair.address),
    },
  ];

  const calculateFeeTVLRatio = useCallback((fees: number, tvl: number) => {
    if (tvl === 0) return 0;
    return (fees / tvl) * 100;
  }, []);

  const H24FeeTVLRatio = useMemo(
    () => calculateFeeTVLRatio(pair.fees24h, pair.reserve_in_usd),
    [pair, calculateFeeTVLRatio],
  );

  const poolTxChanges = useMemo(
    () => [
      {
        name: "5m",
        buyCount: pair.extra.transactions.m5?.buys,
        sellCount: pair.extra.transactions.m5?.sells,
        priceChange: pair.extra.price_change_percentage.m5,
      },
      {
        name: "15m",
        buyCount: pair.extra.transactions.m30?.buys,
        sellCount: pair.extra.transactions.m15?.sells,
        priceChange: pair.extra.price_change_percentage.m15,
      },
      {
        name: "30m",
        buyCount: pair.extra.transactions.m30?.buys,
        sellCount: pair.extra.transactions.m30?.sells,
        priceChange: pair.extra.price_change_percentage.m30,
      },
      {
        name: "1h",
        buyCount: pair.extra.transactions.h1?.buys,
        sellCount: pair.extra.transactions.h1?.sells,
        priceChange: pair.extra.price_change_percentage.h1,
      },
      {
        name: "24h",
        buyCount: pair.extra.transactions.h24?.buys,
        sellCount: pair.extra.transactions.h24?.sells,
        priceChange: pair.extra.price_change_percentage.h24,
      },
    ],
    [pair.extra.transactions, pair.extra.price_change_percentage],
  );

  const poolFlowChanges = useMemo(
    () => [
      {
        name: "5m",
        volume: pair.extra.volume_usd.m5,
      },
      {
        name: "15m",
        volume: pair.extra.volume_usd.m15,
      },
      {
        name: "30m",
        volume: pair.extra.volume_usd.m30,
      },
      {
        name: "1h",
        volume: pair.extra.volume_usd.h1,
      },
      {
        name: "6h",
        volume: pair.extra.volume_usd.h6,
      },
      {
        name: "24h",
        volume: pair.extra.volume_usd.h24,
      },
    ],
    [pair.extra.volume_usd],
  );

  return (
    <div className="flex flex-col space-y-2 bg-white/3 p-4 md:w-96">
      <div className="flex space-x-2">
        {links.map((link) => (
          <Link
            key={link.name}
            href={link.link}
            target="_blank"
            className="grayscale transition bg-black rounded  hover:grayscale-0"
          >
            <Image
              src={link.image}
              alt={link.name}
              width={24}
              height={24}
              className="rounded"
            />
          </Link>
        ))}
      </div>
      <div className="flex space-x-4">
        <div className="flex-1">
          <p>{pair.name}</p>
          <div className="flex items-center gap-x-2">
            <span className=" text-gray/50">TVL</span>
            <Money value={pair.reserve_in_usd} />
          </div>
          <div className="flex items-center gap-x-2">
            <span className=" text-gray/50">FDV</span>
            <Money value={pair.fdv_usd} />
          </div>

          <div className="flex items-center gap-x-2">
            <span className=" text-gray/50">24h Fees</span>
            <Money value={pair.fees24h} />
          </div>
        </div>
        <div className="flex flex-col items-end space-y-1">
          <p>24hr Fee/TVL</p>
          <p className="px-4 py-0.5 text-center bg-violet-700/25 text-violet-500">
            <Decimal value={H24FeeTVLRatio} />%
          </p>
        </div>
      </div>
      <div className="divide-y divide-white/5">
        <div className="flex py-2">
          <div>
            <span className="text-gray/50">Bin step: </span>
            <span className="ml-auto">{pair.bin_step}</span>
          </div>
          <div className="ml-auto">
            <span className="text-gray/50">Base Fee: </span>
            <span className="ml-auto">{pair.base_fee}%</span>
          </div>
        </div>
        <div className="flex py-2">
          <p className="text-gray/50">Market Cap</p>
          <Money
            className="ml-auto"
            value={pair.market_cap_usd}
          />
        </div>
        <div>
          <table className="w-full">
            <thead>
              <tr className="text-gray/50">
                <th className="text-start">Time</th>
                <th className="text-start">Price Change</th>
                <th className="text-end">Transactions</th>
              </tr>
            </thead>
            <tbody>
              {poolTxChanges.map(
                ({ name, buyCount, sellCount, priceChange }) => (
                  <tr key={name}>
                    <td className="text-gray/50">{name}</td>
                    <td>
                      <Decimal
                        showPositiveSign
                        value={priceChange}
                        className={
                          priceChange > -1 ? "text-green-500" : "text-red-500"
                        }
                      />
                    </td>
                    <td>
                      <div className="flex items-center justify-end space-x-2">
                        <Decimal
                          compact
                          hideSign
                          value={buyCount}
                          className="w-16 px-4  bg-green-500/10 text-green text-center rounded-sm"
                        />
                        <Decimal
                          hideSign
                          compact
                          value={sellCount}
                          className="w-16 px-4 bg-red-500/10 text-red text-center rounded-sm"
                        />
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
        <div>
          <table className="w-full">
            <thead className="text-gray/50">
              <tr>
                <th className="text-start">Time</th>
                <th className="text-end">Volume</th>
              </tr>
            </thead>
            <tbody>
              {poolFlowChanges.map(({ name, volume }) => (
                <tr key={name}>
                  <td className="text-gray/50">{name}</td>
                  <td className="text-end">
                    <Money value={volume} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
