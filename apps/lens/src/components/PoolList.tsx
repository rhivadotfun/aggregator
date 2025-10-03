"use client";
import type z from "zod";
import { format } from "util";
import type { Chart } from "@rhiva-ag/dex-api";
import { useCallback, useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import InfiniteScroll from "react-infinite-scroll-component";
import type { pairSelectSchema } from "@rhiva-ag/datasource";
import type { pairFilterSchema, pairOrderBySchema } from "@rhiva-ag/trpc";

import Search from "./Search";
import Filter from "./Filter";
import Decimal from "./Decimal";
import PoolCard from "./PoolCard";
import { useTRPC } from "../trpc.client";
import { trpcClient } from "../trpc.server";

type PoolListProps = {
  limit: number;
  chart?: Chart;
  pools?: z.infer<typeof pairSelectSchema>[];
};

export default function PoolList({ pools = [], limit, chart }: PoolListProps) {
  const trpc = useTRPC();
  const [args, setArgs] = useState<{
    filter?: Partial<z.infer<typeof pairFilterSchema>>;
    orderBy?: z.infer<typeof pairOrderBySchema>;
  }>();

  const fetch = useCallback(
    async ({ pageParam = 0 }) => {
      const pools = await trpcClient.pair.list.query({
        ...args,
        limit,
        offset: pageParam,
        orderBy: ["fees24h"],
        filter: {
          market: { eq: "saros" },
          ...args?.filter,
        },
      });

      return {
        items: pools,
        nextOffset: pools.length === limit ? pageParam + limit : undefined,
      };
    },
    [args, limit],
  );

  const { data, fetchNextPage, refetch, hasNextPage, isFetching } =
    useInfiniteQuery({
      initialData: pools
        ? {
            pages: [
              {
                items: pools,
                nextOffset: pools?.length === limit ? limit : undefined,
              },
            ],
            pageParams: [0],
          }
        : undefined,
      queryFn: fetch,
      initialPageParam: 0,
      queryKey: trpc.pair.list.queryKey(args),
      getNextPageParam: (page) => page.nextOffset,
    });

  const allPages = useMemo(
    () => data?.pages.flatMap((page) => page.items),
    [data?.pages],
  );

  return (
    <section className="flex-1 flex flex-col space-y-4 p-4 md:px-8 2xl:px-16">
      <div className="flex flex-col space-y-4">
        <div className="lt-md:flex-col lt-md:space-y-4 md:flex md:space-x-4 md:items-start">
          <Search
            className="flex-1"
            onSearchAction={(value) => {
              setArgs((args) => {
                return {
                  ...args,
                  search: {
                    name: { ilike: format("%%%s%%", value) },
                    address: { ilike: format("%%%s%%", value) },
                  },
                };
              });
            }}
          />
          {chart && (
            <div className="flex space-x-4">
              <div className="flex flex-col space-y-1 bg-white/5 border border-white/15 p-4 rounded lt-md:flex-1">
                <p className="text-gray">TVL</p>
                <Decimal
                  leading="$"
                  value={parseFloat(chart.liquidity)}
                  className="text-base md:text-xl"
                />
              </div>
              <div className="flex flex-col space-y-1 bg-white/5 border border-white/15 p-4 rounded lt-md:flex-1">
                <p className="text-gray">24H Volume</p>
                <Decimal
                  leading="$"
                  value={parseFloat(chart.cumulativeVolume)}
                  className="text-base md:text-xl"
                />
              </div>
            </div>
          )}
        </div>
        <Filter
          onChangeAction={(filter, orderBy) => {
            setArgs((args) => {
              return { ...args, filter, orderBy };
            });
          }}
        />
      </div>

      <div className="flex-1 flex flex-col space-y-2">
        {isFetching ? (
          <div className="m-auto size-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        ) : (
          <InfiniteScroll
            pullDownToRefresh
            dataLength={allPages.length}
            hasMore={hasNextPage}
            next={fetchNextPage}
            refreshFunction={refetch}
            loader={
              <div className="m-auto size-6 border-3 border-primary border-t-transparent rounded-full animate-spin" />
            }
            className="flex-1 flex flex-col gap-y-4 md:grid md:grid-cols-2 md:gap-4 lg:flex lg:flex-row xl:flex-wrap xl:justify-center"
          >
            {allPages.map((pair) => (
              <PoolCard
                key={pair.address}
                pair={pair}
              />
            ))}
          </InfiniteScroll>
        )}
      </div>
    </section>
  );
}
