/**
 * Seed: SERVICE_INCOMPATIBILITIES — incompatibilidades legales entre servicios.
 *
 * Fuente: data/raw/Matriz de conflictos TSA-TSI OC.xlsx, hoja "Cruces" (la matriz del
 * Anexo 4 del procedimiento GG6 ya normalizada a pares): Código TSA | Descripción |
 * Código TSI | Valor. Semántica del valor (confirmada con negocio 2026-06-11, coherente
 * con la leyenda del Anexo 4: AST="Sí hay conflicto"→1; ECL="vigilancia"→2):
 *   1 = incompatibilidad TOTAL (se excluye al cliente del buscador)
 *   2 = incompatibilidad PARCIAL (el cliente sale con warning)
 *
 * Normalización de códigos (la matriz trae códigos que no facturan tal cual):
 *   - Sufijos de subactividad G10-701-00-IS0044.FE001 → se truncan a la instrucción
 *     real del catálogo (G10-701-00-IS0044). Criterio conservador: el conflicto de
 *     cualquier subactividad aplica al material entero.
 *   - REMAP explícito: G10-524 → G10-524-10 · G10-530 → G10-530-10 (únicos candidatos
 *     en PRODUCT_CATALOG; descripciones divergentes anotadas — validar con negocio).
 *   - Multivalor "S10-524-10 y S40-524-10" → se expande a pares individuales.
 *   - "REVISAR - NO APLICA" (actividad TSI sin código en la propia matriz) → se descarta
 *     y se lista al final como pendiente de negocio.
 *   - Pares duplicados con severidad distinta → gana la más restrictiva (TOTAL).
 *   - Self-pairs (A==B) → se descartan con aviso.
 *
 * Recarga completa (DELETE + INSERT): la matriz es fuente única de esta tabla.
 *
 * Uso: tsx prisma/seeds/18-service-incompatibilities.ts [--dry]
 */

import { prisma } from './lib/prisma';
import * as XLSX from 'xlsx';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const FILE = resolve(__dirname, '../../../data/raw/Input FOCUS  Anexo 4. Matriz de conflictos TSA-TSI OC.xlsx');
const AUDIT = { sourceSystem: 'MATRIZ_CONFLICTOS_OC', etlRunId: BigInt(Date.now()) };

/** Códigos de la matriz que no existen en facturación → material real del catálogo. */
const REMAP: Record<string, string> = {
  'G10-524': 'G10-524-10',
  'G10-530': 'G10-530-10',
};

/** Normaliza un código de la matriz a material_code(s) reales de facturación. */
function normalizeCodes(raw: string): string[] {
  return raw
    .split(/\s+[yY]\s+/) // multivalor "A y B"
    .map(s => s.trim().toUpperCase())
    .filter(Boolean)
    .map(c => REMAP[c] ?? c)
    // Subactividades .FExxx/.LPxxx → instrucción de servicio real del catálogo
    .map(c => c.replace(/^(G10-701-00-IS\d{4})\.[A-Z0-9]+$/, '$1'));
}

export async function seedServiceIncompatibilities(dry = false): Promise<void> {
  console.log(`⚖  Seed SERVICE_INCOMPATIBILITIES${dry ? ' (DRY RUN)' : ''}`);
  console.log(`   Fuente: ${FILE}`);

  const wb = XLSX.readFile(FILE, { cellDates: false });
  const sheet = wb.Sheets['Cruces'];
  if (!sheet) throw new Error('No existe la hoja "Cruces" en la matriz de conflictos');
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null }) as (string | number | null)[][];

  type Pair = { a: string; b: string; severity: 'TOTAL' | 'PARCIAL'; notes: Set<string> };
  const pairs = new Map<string, Pair>(); // clave NO ordenada normalizada (par único A|B con A<B)
  let discarded = 0, selfPairs = 0, conflicts = 0;
  const pendingReview: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const [rawA, desc, rawB, rawVal] = rows[i] ?? [];
    if (rawA == null || rawB == null || rawVal == null) continue;
    const val = String(rawVal).trim();
    if (val !== '1' && val !== '2') { discarded++; continue; }
    const severity: 'TOTAL' | 'PARCIAL' = val === '1' ? 'TOTAL' : 'PARCIAL';

    if (String(rawB).trim().toUpperCase().startsWith('REVISAR')) {
      pendingReview.push(`${String(rawA).trim()} (${String(desc ?? '').trim()})`);
      continue;
    }

    for (const a of normalizeCodes(String(rawA))) {
      for (const b of normalizeCodes(String(rawB))) {
        if (a === b) { selfPairs++; continue; }
        // Par canónico no dirigido: el lado A/B de la matriz se conserva en la fila,
        // pero la unicidad es del par (la incompatibilidad es simétrica).
        const key = [a, b].sort().join('|');
        const existing = pairs.get(key);
        if (!existing) {
          pairs.set(key, { a, b, severity, notes: new Set(desc ? [String(desc).trim()] : []) });
        } else {
          if (existing.severity !== severity) {
            conflicts++;
            existing.severity = 'TOTAL'; // regla restrictiva: ante contradicción, gana TOTAL
          }
          if (desc) existing.notes.add(String(desc).trim());
        }
      }
    }
  }

  const arr = [...pairs.values()];
  const nTotal = arr.filter(p => p.severity === 'TOTAL').length;
  console.log(`   Pares únicos: ${arr.length} (TOTAL: ${nTotal} · PARCIAL: ${arr.length - nTotal})`);
  console.log(`   Descartes → sin valor: ${discarded} · self-pairs: ${selfPairs} · contradicciones resueltas a TOTAL: ${conflicts}`);
  if (pendingReview.length) {
    console.log(`   ⚠ ${pendingReview.length} cruces apuntan a "REVISAR - NO APLICA" (actividad TSI sin código) — pendientes de negocio:`);
    for (const p of [...new Set(pendingReview)]) console.log(`      · ${p}`);
  }

  // Validación contra el catálogo: un código sin catálogo no matchea facturación (inocuo),
  // pero se avisa porque suele indicar un mapeo pendiente.
  const codes = [...new Set(arr.flatMap(p => [p.a, p.b]))];
  const found = await prisma.productCatalog.findMany({ where: { materialCode: { in: codes } }, select: { materialCode: true } });
  const foundSet = new Set(found.map(f => f.materialCode));
  const missing = codes.filter(c => !foundSet.has(c));
  console.log(`   Códigos distintos: ${codes.length} · en PRODUCT_CATALOG: ${foundSet.size}${missing.length ? ` · ⚠ SIN catálogo: ${missing.join(', ')}` : ''}`);

  if (dry) { console.log('   (dry run — no se escribe nada)'); return; }

  const del = await prisma.serviceIncompatibility.deleteMany({});
  const res = await prisma.serviceIncompatibility.createMany({
    data: arr.map(p => ({
      externalGuid: randomUUID(),
      materialCodeA: p.a,
      materialCodeB: p.b,
      severity: p.severity,
      sourceNote: [...p.notes].join(' · ').slice(0, 500) || null,
      ...AUDIT,
    })),
  });
  console.log(`   🗑 ${del.count} previos eliminados · ✔ ${res.count} pares insertados`);
}

if (require.main === module) {
  seedServiceIncompatibilities(process.argv.includes('--dry'))
    .then(() => prisma.$disconnect())
    .catch(err => { console.error(err); prisma.$disconnect(); process.exit(1); });
}
