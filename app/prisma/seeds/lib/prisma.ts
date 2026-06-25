import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error('DATABASE_URL no está definida en .env');

const u = new URL(dbUrl);
const adapter = new PrismaMariaDb({
  host: u.hostname,
  port: Number(u.port) || 3306,
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database: u.pathname.slice(1),
  connectionLimit: 5,
  allowPublicKeyRetrieval: true,
});

export const prisma = new PrismaClient({ adapter });

export const SEED_AUDIT = {
  sourceSystem: 'SEED_INITIAL',
  etlRunId: BigInt(Date.now()),
};