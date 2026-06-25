/**
 * Consultas del registro de auditoría (AUDIT_EVENTS). Solo las usa la página
 * /auditoria, restringida a administradores (IAM_MANAGE).
 *
 * Sin caché a propósito: el dato debe verse al instante y el volumen por página es
 * pequeño. El filtrado y la paginación son server-side; los filtros viven en la URL.
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export type AuditSearchOpts = {
  /** Filtra por el actor (username del log; identifica también logins fallidos sin AppUser). */
  username?: string;
  category?: string;
  eventType?: string;
  outcome?: string;
  /** Rango de fechas (YYYY-MM-DD), inclusivo en ambos extremos. */
  dateFrom?: string;
  dateTo?: string;
  /** Texto libre sobre usuario / descripción / IP. */
  q?: string;
  page?: number;
  pageSize?: number;
};

export type AuditEventRow = {
  auditId: number;
  createdAt: Date;
  userId: number | null;
  username: string;
  userFullName: string | null;
  eventType: string;
  category: string;
  outcome: string;
  description: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
};

export type AuditSearchResult = {
  rows: AuditEventRow[];
  total: number;
  page: number;
  pageSize: number;
};

export const AUDIT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

function buildWhere(opts: AuditSearchOpts): Prisma.AuditEventWhereInput {
  const where: Prisma.AuditEventWhereInput = {};
  if (opts.username) where.username = opts.username;
  if (opts.category) where.category = opts.category;
  if (opts.eventType) where.eventType = opts.eventType;
  if (opts.outcome) where.outcome = opts.outcome;

  // Rango de fechas sobre createdAt (dateTo inclusivo: hasta el final del día).
  if (opts.dateFrom || opts.dateTo) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (opts.dateFrom) createdAt.gte = new Date(`${opts.dateFrom}T00:00:00`);
    if (opts.dateTo) createdAt.lte = new Date(`${opts.dateTo}T23:59:59.999`);
    where.createdAt = createdAt;
  }

  if (opts.q?.trim()) {
    const q = opts.q.trim();
    where.OR = [
      { username: { contains: q } },
      { userFullName: { contains: q } },
      { description: { contains: q } },
      { ipAddress: { contains: q } },
    ];
  }
  return where;
}

/** Búsqueda paginada para la tabla de /auditoria. */
export async function searchAuditEvents(opts: AuditSearchOpts): Promise<AuditSearchResult> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, opts.pageSize ?? AUDIT_PAGE_SIZE));
  const where = buildWhere(opts);

  const [total, rows] = await Promise.all([
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { rows: rows as AuditEventRow[], total, page, pageSize };
}

/**
 * Chunk de eventos (para el export CSV en streaming). Aplica los mismos filtros que
 * la búsqueda; el route handler itera con `skip`/`take` hasta agotar o alcanzar el tope.
 */
export async function getAuditEventsChunk(opts: AuditSearchOpts, skip: number, take: number): Promise<AuditEventRow[]> {
  const rows = await prisma.auditEvent.findMany({
    where: buildWhere(opts),
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  });
  return rows as AuditEventRow[];
}

/** Usuarios distintos presentes en el log (incluye usernames de logins fallidos sin AppUser). */
export async function getAuditFilterUsers(): Promise<{ username: string; userFullName: string | null }[]> {
  return prisma.auditEvent.findMany({
    distinct: ['username'],
    select: { username: true, userFullName: true },
    orderBy: { username: 'asc' },
  });
}
