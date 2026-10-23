import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";

// Uma instância só, mesmo com o hot reload do Next em desenvolvimento.
const global = globalThis as unknown as { prisma?: PrismaClient };

function criar(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./data/prospectar.db" });
  return new PrismaClient({ adapter });
}

export const db = global.prisma ?? criar();
if (process.env.NODE_ENV !== "production") global.prisma = db;
