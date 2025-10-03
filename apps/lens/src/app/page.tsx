import moment from "moment";
import Image from "next/image";

import { dexApi } from "../instances";
import Saros from "../assets/saros.jpg";
import Header from "../components/Header";
import PoolList from "../components/PoolList";

export const dynamic = "force-dynamic";
export default async function HomePage() {
  const sarosChartResponse = await dexApi.saros.pool.chart(
    moment().startOf("day").toDate().getTime(),
  );

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
          limit={24}
          chart={sarosChartResponse.data.at(0)}
        />
      </div>
    </div>
  );
}
