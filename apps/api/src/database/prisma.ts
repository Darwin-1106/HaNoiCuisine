// Shared Prisma client (one DB connection pool for the whole API)
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();
