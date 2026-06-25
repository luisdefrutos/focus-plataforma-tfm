/**
 * Inspección 2 de la matriz de conflictos: leyenda (filas finales de Sheet1),
 * resumen completo de la hoja Cruces y códigos con multivalor.
 *
 * Uso: npx tsx prisma/seeds/lib/inspect-conflict-matrix-2.ts
 */
import * as XLSX from 'xlsx';
import { resolve } from 'node:path';

const FILE = resolve(__dirname, '../../../../data/raw/Matriz de conflictos TSA-TSI OC.xlsx');
const wb = XLSX.readFile(FILE, { dense: true });

// 1) Sheet1: filas 40..78 completas (sin truncar) para leer el segundo bloque y la LEYENDA
const s1: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1']!, { header: 1, raw: true, defval: null });
console.log('── Sheet1 filas 40-78 (texto completo de celdas no vacías) ──');
for (let i = 40; i < Math.min(s1.length, 79); i++) {
  const r = s1[i] ?? [];
  const cells = r.map((v, c) => (v == null ? null : `[${c}] ${String(v).replace(/\s+/g, ' ').trim()}`)).filter(Boolean);
  if (cells.length) console.log(`${String(i).padStart(3)} | ${cells.join('  ·  ')}`);
}

// 2) Cruces: resumen completo
const cruces: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets['Cruces']!, { header: 1, raw: true, defval: null });
const pairs = new Map<string, { a: string; b: string; val: string; descs: Set<string> }>();
const byVal = new Map<string, number>();
const codesA = new Set<string>();
const codesB = new Set<string>();
for (let i = 1; i < cruces.length; i++) {
  const [a, desc, b, val] = cruces[i] ?? [];
  if (a == null || b == null || val == null) continue;
  const A = String(a).trim(), B = String(b).trim(), V = String(val).trim();
  codesA.add(A); codesB.add(B);
  byVal.set(V, (byVal.get(V) ?? 0) + 1);
  const key = `${A}|${B}`;
  if (!pairs.has(key)) pairs.set(key, { a: A, b: B, val: V, descs: new Set() });
  const p = pairs.get(key)!;
  if (p.val !== V) console.log(`⚠ Par ${key} con valores distintos: ${p.val} vs ${V} (desc: ${desc})`);
  if (desc) p.descs.add(String(desc).trim());
}
console.log(`\n── Cruces ──`);
console.log(`Filas de datos: ${cruces.length - 1} · pares únicos (A|B): ${pairs.size}`);
console.log(`Por valor: ${[...byVal].map(([v, n]) => `${v}→${n}`).join('  ')}`);
console.log(`Códigos TSA distintos (A): ${codesA.size} → ${[...codesA].sort().join(', ')}`);
console.log(`Códigos TSI distintos (B): ${codesB.size} → ${[...codesB].sort().join(', ')}`);
const multi = [...codesA, ...codesB].filter(c => / y /i.test(c));
console.log(`Códigos con multivalor ("X y Y"): ${multi.length ? multi.join(' | ') : 'ninguno'}`);

// ¿Hay pares duplicados con el mismo valor? ¿Y simetría A↔B?
let symmetric = 0;
for (const { a, b } of pairs.values()) if (pairs.has(`${b}|${a}`)) symmetric++;
console.log(`Pares con el inverso también presente: ${symmetric} (de ${pairs.size})`);
