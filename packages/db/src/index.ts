import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export { schema };
export * from "./schema";

const url = process.env.DATABASE_URL ?? "postgres://localhost:5432/timefly";

declare global {
  // eslint-disable-next-line no-var
  var __timeflySql: ReturnType<typeof postgres> | undefined;
}

// Reuse the connection across hot reloads in dev.
const client = globalThis.__timeflySql ?? postgres(url, { max: 10, prepare: false });
if (process.env.NODE_ENV !== "production") globalThis.__timeflySql = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
