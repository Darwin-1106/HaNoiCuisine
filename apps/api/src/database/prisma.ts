// Shared Prisma client (one DB connection pool for the whole API)
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import { requireEnv } from '../config/env.js';

const adapter = new PrismaMariaDb(requireEnv('DATABASE_URL'));
export const prisma = new PrismaClient({ adapter });
