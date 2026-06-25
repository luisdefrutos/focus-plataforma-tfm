/**
 * Singleton de PrismaClient para Next.js (RSC, Server Actions, API routes).
 *
 * Patrón: una sola instancia por proceso. En dev, Next.js hot-reloads módulos y crearía
 * múltiples instancias → cachear en `globalThis` durante desarrollo.
 *
 * Prisma 7 requiere driver adapter (MariaDB para MySQL). Parseamos DATABASE_URL del .env
 * y construimos el adapter con las credenciales URL-decoded.
 */

import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';

function buildPrismaClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL no está definida en .env');

  const u = new URL(dbUrl);
  const host = u.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';

  // TLS de la conexión a MySQL. Por defecto: ON salvo en localhost (dev). Override
  // explícito con DATABASE_SSL=true|false.
  const sslEnv = process.env.DATABASE_SSL;
  const useSsl = sslEnv != null ? sslEnv === 'true' : !isLocal;

  // `allowPublicKeyRetrieval` permite, con caching_sha2_password y SIN TLS, que un
  // MITM sustituya su clave RSA y capture la contraseña en claro (CWE-319). Solo se
  // habilita en local sin TLS (dev), o si se fuerza explícitamente. En remoto va OFF.
  const allowPublicKeyRetrieval =
    process.env.DATABASE_ALLOW_PUBLIC_KEY_RETRIEVAL === 'true' || (isLocal && !useSsl);

  // Fail-closed: nunca conectar a un host remoto sin TLS (expondría la credencial).
  if (!isLocal && !useSsl) {
    throw new Error(
      `DATABASE_URL apunta a un host remoto (${host}) sin TLS. Configura DATABASE_SSL=true ` +
        `(o usa un host local). Conectar en claro expondría la contraseña de la BD.`,
    );
  }

  const adapter = new PrismaMariaDb({
    host,
    port: Number(u.port) || 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.slice(1),
    connectionLimit: 10,
    allowPublicKeyRetrieval,
    // ssl: true valida el certificado contra las CAs del sistema. Para una CA
    // corporativa propia, montar { ca: ... } vía configuración del entorno.
    ...(useSsl ? { ssl: true } : {}),
  });

  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? buildPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;