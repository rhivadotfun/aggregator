import { DexApi } from "@rhiva-ag/dex-api";
import { coingecko, db } from "../instances";
import { indexSaros } from "./index-saros.job";

(async () => {
  await indexSaros(db, new DexApi(), coingecko);
})();
