import { DexApi } from "@rhiva-ag/dex-api";
import Coingecko from "@coingecko/coingecko-typescript";

export const dexApi = new DexApi();
export const coingecko = new Coingecko({
  environment: "pro",
  proAPIKey: process.env.NEXT_PUBLIC_COINGECKO_API_KEY,
});
