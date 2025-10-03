import pino from "pino";
import { web3 } from "@coral-xyz/anchor";
import { createDB } from "@rhiva-ag/datasource";
import { Client } from "@solana-tracker/data-api";
import Coingecko from "@coingecko/coingecko-typescript";

import { getEnv } from "./env";

export const logger = pino();

export const connection = new web3.Connection(getEnv("RPC_URL"), {
  wsEndpoint: getEnv("RPC_URL")
    .replace(/^https/, "wss")
    .replace(/^http?/, "ws"),
});
export const solanatracker = new Client({
  apiKey: getEnv("SOLANA_TRACKER_API_KEY"),
});

export const db = createDB(getEnv("DATABASE_URL"));

export const coingecko = new Coingecko({
  environment: "pro",
  proAPIKey: getEnv<string>("COINGECKO_API_KEY"),
});
