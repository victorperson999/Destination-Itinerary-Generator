import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { 
    prisma?: PrismaClient;
    adapter?: PrismaPg;
};

const connectionString = process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is missing. Check your .env / .env.local (or Vercel environment variables).");
}

const adapter = globalForPrisma.adapter ?? new PrismaPg({ connectionString });

export const prisma = 
    globalForPrisma.prisma??
    new PrismaClient({
        adapter,
        log: ["error", "warn"],
});

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.adapter = adapter;
    globalForPrisma.prisma = prisma;
}

