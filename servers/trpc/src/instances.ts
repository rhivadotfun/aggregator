import { Redis } from "ioredis";
import { Connection } from "@solana/web3.js";
import { createDB } from "@rhiva-ag/datasource";
import { Client } from "@solana-tracker/data-api";
import Coingecko from "@coingecko/coingecko-typescript";

import { getEnv } from "./env";

export const redis = new Redis(getEnv("REDIS_URL"), {
  maxRetriesPerRequest: null,
});
export const db = createDB(getEnv("DATABASE_URL"));
export const connection = new Connection(getEnv("RPC_URL"));
export const solanatracker = new Client({
  apiKey: getEnv("SOLANA_TRACKER_API_KEY"),
});
export const coingecko = new Coingecko({
  environment: "pro",
  proAPIKey: getEnv<string>("COINGECKO_API_KEY"),
});
