import { coingecko, connection, db, solanatracker } from "./instances";

export const createContext = async () => {
  return {
    coingecko,
    drizzle: db,
    solanatracker,
    solanaConnection: connection,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;
