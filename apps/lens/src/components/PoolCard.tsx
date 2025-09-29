import type z from "zod";
import Link from "next/link";
import { format } from "util";
import Image from "next/image";
import { useCallback, useMemo } from "react";
import type { pairAggregateSchema } from "@rhiva-ag/trpc";

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
  pair: z.infer<typeof pairAggregateSchema>;
}) {
  const links = [
    {
      image: BirdEye,
      name: "birdeye",
      link: format(
        "https://birdeye.so/solana/token/%s/%s",
        pair.baseMint.id,
        pair.id,
      ),
    },
    {
      image: Saros,
      name: "saros",
      link: format("https://dlmm.saros.xyz/pool/%s", pair.id),
    },
    {
      image: Dexscreener,
      name: "dexscreener",
      link: format("https://dexscreener.com/solana/%s", pair.id),
    },
    {
      image: Jupiter,
      name: "jupiter",
      link: format(
        "https://jup.ag/swap?sell=%s&buy=%s",
        pair.baseMint.id,
        pair.quoteMint.id,
      ),
    },
    {
      image: Photon,
      name: "photon",
      link: format("https://photon-sol.tinyastro.io/en/lp/%s", pair.id),
    },
  ];

  const calculateFeeTVLRatio = useCallback((fees: number, tvl: number) => {
    if (tvl === 0) return 0;
    return (fees / tvl) * 100;
  }, []);

  const H24FeeTVLRatio = useMemo(
    () => calculateFeeTVLRatio(pair.H24.fees, pair.H24.tvl),
    [pair, calculateFeeTVLRatio],
  );

  const poolTxChanges = useMemo(
    () => [
      { name: "5m", buyCount: pair.M5.buyCount, sellCount: pair.M5.sellCount },
      { name: "1h", buyCount: pair.H1.buyCount, sellCount: pair.H1.sellCount },
      { name: "6h", buyCount: pair.H6.buyCount, sellCount: pair.H6.sellCount },
      {
        name: "24h",
        buyCount: pair.H24.buyCount,
        sellCount: pair.H24.sellCount,
      },
    ],
    [pair],
  );

  const poolFlowChanges = useMemo(
    () => [
      {
        name: "5m",
        volume: pair.M5.volume,
        tvl: pair.M5.tvl,
        fees: pair.M5.fees,
        tvlFeeRatio: calculateFeeTVLRatio(pair.M5.tvl, pair.M5.fees),
      },
      {
        name: "1h",
        volume: pair.H1.volume,
        tvl: pair.H1.tvl,
        fees: pair.H1.fees,
        tvlFeeRatio: calculateFeeTVLRatio(pair.H1.tvl, pair.H1.fees),
      },
      {
        name: "6h",
        volume: pair.H6.volume,
        tvl: pair.H6.tvl,
        fees: pair.H6.fees,
        tvlFeeRatio: calculateFeeTVLRatio(pair.H6.tvl, pair.H6.fees),
      },
      {
        name: "24h",
        volume: pair.H24.volume,
        tvl: pair.H24.tvl,
        fees: pair.H24.fees,
        tvlFeeRatio: calculateFeeTVLRatio(pair.H24.tvl, pair.H24.fees),
      },
    ],
    [pair, calculateFeeTVLRatio],
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
            <span className=" text-gray/50">Today's Fees</span>
            <Money value={pair.H24?.fees} />
          </div>
          <div className="flex items-center gap-x-2">
            <span className=" text-gray/50">24h Fees</span>
            <Money value={pair.H24?.fees} />
          </div>
          <div className="flex items-center gap-x-2">
            <span className=" text-gray/50">TVL</span>
            <Money value={pair.liquidity} />
          </div>
          <div className="flex items-center gap-x-2">
            <span className=" text-gray/50">Volume 24h</span>
            <Money value={pair.H24?.volume} />
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
            <span className="ml-auto">{pair.binStep}</span>
          </div>
          <div className="ml-auto">
            <span className="text-gray/50">Base Fee: </span>
            <span className="ml-auto">{pair.baseFee}%</span>
          </div>
        </div>
        <div className="flex py-2">
          <p className="text-gray/50">Market Cap</p>
          <Money
            className="ml-auto"
            value={pair.liquidity}
          />
        </div>
        <div>
          <table className="w-full">
            <thead>
              <tr className="text-gray/50">
                <th className="text-start">Time</th>
                <th className="text-start invisible">Price Change</th>
                <th className="text-end">Transactions</th>
              </tr>
            </thead>
            <tbody>
              {poolTxChanges.map(({ name, buyCount, sellCount }) => (
                <tr key={name}>
                  <td className="text-gray/50">{name}</td>
                  <td className="invisible">-25%</td>
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
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <table className="w-full">
            <thead className="text-gray/50">
              <tr>
                <th className="text-start">Time</th>
                <th className="text-start">Volume</th>
                <th className="text-end">Fees/TVL Ratio</th>
              </tr>
            </thead>
            <tbody>
              {poolFlowChanges.map(({ name, volume, fees, tvlFeeRatio }) => (
                <tr key={name}>
                  <td className="text-gray/50">{name}</td>
                  <td>
                    <Money value={volume} />
                  </td>
                  <td className="flex items-center justify-end space-x-2">
                    <p>
                      <Money value={fees} />
                    </p>
                    <Decimal
                      value={tvlFeeRatio}
                      end="%"
                      cap={999}
                      className="w-16 bg-blue-500/10 text-blue text-center rounded-sm"
                    />
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
