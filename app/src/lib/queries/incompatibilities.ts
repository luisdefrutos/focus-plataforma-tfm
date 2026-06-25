/**
 * Incompatibilidades legales entre servicios (SERVICE_INCOMPATIBILITIES — matriz de
 * conflictos OC del Anexo 4 GG6, cargada por el seed 18).
 *
 * Dado el conjunto de materiales que el usuario filtra en el Buscador 360, resuelve
 * qué materiales son incompatibles con esa selección:
 *   - TOTAL  → la entidad (organización completa) que los facture se EXCLUYE.
 *   - PARCIAL→ la entidad se muestra con warning (requiere vigilancia).
 * La relación se trata como NO dirigida: si la selección toca cualquiera de los dos
 * lados del par, el otro lado pasa a ser conflictivo.
 */

import { prisma } from '@/lib/prisma';

export type IncompatibilityPair = {
  /** Material de la selección del usuario que origina el conflicto. */
  selected: string;
  selectedDesc: string | null;
  /** Material incompatible con él (el cliente que lo facture se excluye / se marca). */
  conflicting: string;
  conflictingDesc: string | null;
  severity: 'TOTAL' | 'PARCIAL';
};

export type IncompatibilityResolution = {
  /** Materiales con conflicto TOTAL frente a la selección (excluyen la entidad). */
  totalCodes: string[];
  /** Materiales con conflicto PARCIAL (warning). Sin solape con totalCodes. */
  partialCodes: string[];
  pairs: IncompatibilityPair[];
};

type MatrixRow = { materialCodeA: string; materialCodeB: string; severity: 'TOTAL' | 'PARCIAL' };
type Matrix = { rows: MatrixRow[]; descByCode: Map<string, string | null> };

// La matriz es pequeña (≤ ~100 pares) y solo cambia al re-seedear → caché de módulo, TTL 5 min.
let matrixCache: { expires: number; data: Matrix } | null = null;

async function loadMatrix(): Promise<Matrix> {
  const now = Date.now();
  if (matrixCache && matrixCache.expires > now) return matrixCache.data;

  const rows = await prisma.serviceIncompatibility.findMany({
    select: { materialCodeA: true, materialCodeB: true, severity: true },
  });
  const codes = [...new Set(rows.flatMap(r => [r.materialCodeA, r.materialCodeB]))];
  const cat = codes.length
    ? await prisma.productCatalog.findMany({
        where: { materialCode: { in: codes } },
        select: { materialCode: true, descriptionEs: true, descriptionEn: true },
      })
    : [];
  const descByCode = new Map(cat.map(c => [c.materialCode, c.descriptionEs ?? c.descriptionEn ?? null]));

  const data: Matrix = { rows, descByCode };
  matrixCache = { expires: now + 300 * 1000, data };
  return data;
}

export type MaterialConflict = {
  /** Material incompatible con el de la fila. */
  code: string;
  description: string | null;
  severity: 'TOTAL' | 'PARCIAL';
};

/**
 * Mapa material → materiales incompatibles (relación NO dirigida, ambos sentidos),
 * para mostrar los conflictos de cada servicio en el catálogo.
 * Orden: TOTAL antes que PARCIAL, alfabético dentro de cada severidad.
 */
export async function getIncompatibilityMap(): Promise<Map<string, MaterialConflict[]>> {
  const { rows, descByCode } = await loadMatrix();
  const map = new Map<string, MaterialConflict[]>();
  const add = (from: string, to: string, severity: 'TOTAL' | 'PARCIAL') => {
    if (!map.has(from)) map.set(from, []);
    map.get(from)!.push({ code: to, description: descByCode.get(to) ?? null, severity });
  };
  for (const r of rows) {
    add(r.materialCodeA, r.materialCodeB, r.severity);
    add(r.materialCodeB, r.materialCodeA, r.severity);
  }
  for (const list of map.values()) {
    list.sort((a, b) =>
      a.severity === b.severity
        ? a.code.localeCompare(b.code)
        : a.severity === 'TOTAL' ? -1 : 1);
  }
  return map;
}

/**
 * Resuelve los conflictos de una selección de materiales. Devuelve null si la selección
 * está vacía o no toca ningún par de la matriz (el buscador no aplica nada en ese caso).
 */
export async function resolveIncompatibilities(materialCodes: string[] | undefined): Promise<IncompatibilityResolution | null> {
  if (!materialCodes || materialCodes.length === 0) return null;
  const { rows, descByCode } = await loadMatrix();
  if (rows.length === 0) return null;

  const sel = new Set(materialCodes);
  const pairs: IncompatibilityPair[] = [];
  const totalCodes = new Set<string>();
  const partialCodes = new Set<string>();

  for (const r of rows) {
    const sides: { selected: string; conflicting: string }[] = [];
    if (sel.has(r.materialCodeA)) sides.push({ selected: r.materialCodeA, conflicting: r.materialCodeB });
    if (sel.has(r.materialCodeB)) sides.push({ selected: r.materialCodeB, conflicting: r.materialCodeA });
    for (const s of sides) {
      pairs.push({
        ...s,
        severity: r.severity,
        selectedDesc: descByCode.get(s.selected) ?? null,
        conflictingDesc: descByCode.get(s.conflicting) ?? null,
      });
      (r.severity === 'TOTAL' ? totalCodes : partialCodes).add(s.conflicting);
    }
  }
  if (pairs.length === 0) return null;

  // Un material puede ser TOTAL frente a un seleccionado y PARCIAL frente a otro:
  // si ya excluye, el warning es redundante.
  for (const c of totalCodes) partialCodes.delete(c);

  return { totalCodes: [...totalCodes], partialCodes: [...partialCodes], pairs };
}
