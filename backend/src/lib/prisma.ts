import { PrismaClient } from "@prisma/client";

// Single shared instance to avoid exhausting Postgres connections in dev
// with hot-reload (ts-node-dev would otherwise create a new client per reload).
export const prisma = new PrismaClient();
