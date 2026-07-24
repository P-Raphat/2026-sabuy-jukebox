import { PrismaClient } from "@prisma/client";

// Prisma singleton — survives Next's module reloads and is shared with the
// custom server process via globalThis (one Node process, one globalThis).
const g = globalThis as unknown as { __jukebox_prisma?: PrismaClient };

// Always cache on globalThis (even in prod): the custom server and Next's
// route handlers are separate module registries in one process — two
// PrismaClients on the same SQLite file would fight for the write lock.
export const prisma =
  g.__jukebox_prisma ?? new PrismaClient({ log: ["warn", "error"] });

g.__jukebox_prisma = prisma;
