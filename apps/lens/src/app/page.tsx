import moment from "moment";
import Image from "next/image";
import { SarosApi } from "@rhiva-ag/dex-api";

import Saros from "../assets/saros.jpg";
import Header from "../components/Header";
import { trpcClient } from "../trpc.server";
import PoolList from "../components/PoolList";

export default async function HomePage() {
  const dexApi = new SarosApi("https://api.saros.xyz/api/");
  const sarosCharts = await dexApi.pool.chart(
    moment().startOf("day").toDate().getTime(),
  );
  const pools = await trpcClient.pair.aggregrate.query({
    filter: { market: { eq: "saros" } },
  });

  return (
    <div className="flex-1 flex flex-col space-y-4">
      <Header />
      <div className="flex-1 flex flex-col space-y-2">
        <div className="flex space-x-2 items-center px-4 md:px-8 2xl:px-16">
          <p className="text-lg font-medium">Saros DLMM Pools</p>
          <Image
            src={Saros}
            width={24}
            height={24}
            alt="Saros"
            className="size-8 rounded-md"
          />
        </div>
        <PoolList
          pools={pools}
          limit={24}
          chart={sarosCharts.data.at(0)}
        />
      </div>
    </div>
  );
}
