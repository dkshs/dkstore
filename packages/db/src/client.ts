import { env } from "./env";
import { PrismaClient } from "./generated/client";

const createPrismaClient = () => new PrismaClient({ log: ["error"] });

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
