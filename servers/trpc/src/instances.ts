import { Redis } from "ioredis";
import { Connection } from "@solana/web3.js";
import { createDB } from "@rhiva-ag/datasource";
import { Client } from "@solana-tracker/data-api";
import Coingecko from "@coingecko/coingecko-typescript";

import { getEnv } from "./env";

export const redis = new Redis({
  sentinels: [
    { host: getEnv<string>("REDIS_HOSTNAME"), port: 26379 },
    { host: getEnv<string>("REDIS_HOSTNAME"), port: 26380 },
    { host: getEnv<string>("REDIS_HOSTNAME"), port: 26381 },
    { host: getEnv<string>("REDIS_HOSTNAME"), port: 26382 },
  ],
  name: getEnv<string>("REDIS_MASTER"),
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
