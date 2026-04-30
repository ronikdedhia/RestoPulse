import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';
import { logger } from '../utils/logger';

const libsql = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const adapter = new PrismaLibSQL(libsql);
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function connectDB() {
  try {
    await prisma.$connect();
    logger.info('Turso (libsql) connected');
  } catch (error) {
    logger.error(`DB connection failed: ${error}`);
    throw error;
  }
}

export async function disconnectDB() {
  await prisma.$disconnect();
}
