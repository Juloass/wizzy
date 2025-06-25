// lib/prisma.ts
import { PrismaClient } from "@wizzy/prisma";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"], // Ajoute "query" en dev si besoin
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
