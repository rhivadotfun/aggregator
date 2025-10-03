import "dotenv/config";

import { format } from "util";

type Env =
  | "PORT"
  | "HOST"
  | "ORIGIN"
  | "REDIS_HOSTNAME"
  | "REDIS_MASTER"
  | "REDIS_URL"
  | "DATABASE_URL"
  | "COINGECKO_API_KEY"
  | "SOLANA_TRACKER_API_KEY"
  | "RPC_URL";

export const getEnv = <T extends object | number | string | null = string>(
  name: Env,
  refine?: <K>(value: K) => T,
) => {
  const value = process.env[format("APP_%s", name)] || process.env[name];
  if (value)
    try {
      const parsed = JSON.parse(value) as T;
      return refine ? (refine(parsed) as T) : parsed;
    } catch {
      return (refine ? refine(value) : value) as T;
    }
  throw new Error(format("%s not found in env file", name));
};
