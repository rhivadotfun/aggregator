import { ApiImpl } from "../api-impl";
import type { Chart } from "./models/chart.model";
import type { Pair, Pool } from "./models/pool.model";
import type { Response } from "./models/response.model";

export class PoolApi extends ApiImpl {
  path: string = "dex-v3/pool";

  list(page: number = 1) {
    return ApiImpl.getData(
      this.xior.get<Response<{ data: Pool[]; page: number; total: number }>>(
        this.buildPathWithQueryString(this.path, { page }),
      ),
    );
  }

  retrieve(id: string) {
    return ApiImpl.getData(this.xior.get<Response<Pair>>(this.buildPath(id)));
  }

  chart(startTime: number = 1747008000000) {
    return ApiImpl.getData(
      this.xior.get<Response<Chart[]>>(
        this.buildPathWithQueryString(this.buildPath("overview/chart"), {
          startTime,
        }),
      ),
    );
  }
}
