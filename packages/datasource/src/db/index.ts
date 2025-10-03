import { drizzle } from "drizzle-orm/node-postgres";

export * from "./zod-query";
export * from "./drizzle-query";
export * from "./custom-drizzle";
import * as schema from "../db";

export * from "./zod";
export * from "./schema";

export const createDB = (url: string) => drizzle(url, { schema });
export type Database = ReturnType<typeof createDB>;
