import { PrismaClient } from "@prisma/client";

export const hasDatabaseUrl = Boolean(
    process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0
);

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: [],
    });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
