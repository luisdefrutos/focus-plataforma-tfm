/**
 * Análisis one-off de los nuevos extractos de inspecciones (AT, BT, GESAP_TSA, GESAP_TSI)
 * para decidir el diseño del loader: unidad del plazo, cobertura de CIF/SAP,
 * multivalor de facturas, unicidad de códigos e identidad de activo.
 *
 * Uso: npx tsx prisma/seeds/lib/analyze-inspections-new.ts
 */
import * as XLSX from 'xlsx';
import { resolve } from 'node:path';

const RAW = resolve(__dirname, '../../../../data/raw');
const FILES = ['Inspecciones_AT.xlsx', 'Inspecciones_BT.xlsx', 'Inspecciones_GESAP_TSA.xlsx', 'Inspecciones_GESAP_TSI.xlsx'];

// Layout común a los 4 ficheros (verificado con inspect-inspections-new.ts)
const C = {
  cod: 0, fIns: 1, fProx: 2, plazo: 3,
  emplName: 4, instName: 5, addr: 6, cp: 7, city: 8, prov: 9,
  offer: 10, pedido: 11, facturas: 12,
  gSap: 13, gCif: 14, gName: 15,
  tSap: 26, tCif: 27, tName: 28,
} as const;
const DATA_START = 3;

const cleanStr = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};
const normCif = (v: unknown): string | null => {
  const s = cleanStr(v);
  if (!s) return null;
  let c = s.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (/^ES[0-9A-Z]{9}$/.test(c)) c = c.slice(2);
  return c || null;
};
const isPlausibleCif = (c: string | null): boolean => !!c && /^[0-9A-Z]{8,16}$/.test(c) && /\d/.test(c);
const excelDate = (v: unknown): Date | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'string' ? Number(v) : (v as number);
  if (!Number.isFinite(n) || n <= 0) return null;
  const d = new Date((n - 25569) * 86400 * 1000);
  const y = d.getUTCFullYear();
  return y < 1990 || y > 2200 ? null : d;
};
const pct = (n: number, total: number) => `${((n / total) * 100).toFixed(1)}%`;
const median = (xs: number[]): number => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};

for (const f of FILES) {
  const wb = XLSX.readFile(resolve(RAW, f), { cellDates: false });
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]!]!, { header: 1, defval: null }) as (string | number | null)[][];
  const data = rows.slice(DATA_START).filter(r => r && r.some(v => v != null && v !== ''));
  const n = data.length;

  console.log(`\n${'═'.repeat(90)}\n📄 ${f} — ${n} filas de datos`);

  // 1) Unicidad del código
  const codCount = new Map<string, number>();
  let codNull = 0;
  for (const r of data) {
    const c = cleanStr(r[C.cod]);
    if (!c) { codNull++; continue; }
    codCount.set(c, (codCount.get(c) ?? 0) + 1);
  }
  const dups = [...codCount].filter(([, k]) => k > 1);
  console.log(`   Código (col0): nulos=${codNull}  únicos=${codCount.size}  duplicados=${dups.length}` +
    (dups.length ? `  ej: ${dups.slice(0, 3).map(([c, k]) => `${c}×${k}`).join(', ')}` : ''));

  // 2) Fechas
  let fInsOk = 0, fProxOk = 0;
  let minY = 9999, maxY = 0;
  for (const r of data) {
    const d1 = excelDate(r[C.fIns]);
    const d2 = excelDate(r[C.fProx]);
    if (d1) { fInsOk++; const y = d1.getUTCFullYear(); if (y < minY) minY = y; if (y > maxY) maxY = y; }
    if (d2) fProxOk++;
  }
  console.log(`   Fechas: inspección ${pct(fInsOk, n)} (años ${minY}-${maxY})  próxima ${pct(fProxOk, n)}`);

  // 3) Plazo: unidad inferida por valor (mediana de días entre fechas / valor)
  const byPlazo = new Map<number, number[]>();
  for (const r of data) {
    const p = Number(cleanStr(r[C.plazo]));
    const d1 = excelDate(r[C.fIns]);
    const d2 = excelDate(r[C.fProx]);
    if (!Number.isFinite(p) || p <= 0 || !d1 || !d2) continue;
    const days = (d2.getTime() - d1.getTime()) / 86400000;
    if (days <= 0) continue;
    if (!byPlazo.has(p)) byPlazo.set(p, []);
    byPlazo.get(p)!.push(days);
  }
  const plazoTop = [...byPlazo].sort((a, b) => b[1].length - a[1].length).slice(0, 8);
  for (const [p, days] of plazoTop) {
    const m = median(days);
    const perUnit = m / p;
    const unidad = perUnit > 250 ? 'AÑOS' : perUnit > 20 ? 'MESES' : '??';
    console.log(`   Plazo=${String(p).padStart(4)} → ${days.length} filas, mediana ${Math.round(m)} días (${(m / p).toFixed(0)} días/unidad → ${unidad})`);
  }

  // 4) CIF / SAP gestor y titular
  let gOk = 0, tOk = 0, same = 0, gSapOk = 0, tSapOk = 0, anyCif = 0;
  for (const r of data) {
    const g = normCif(r[C.gCif]);
    const t = normCif(r[C.tCif]);
    if (isPlausibleCif(g)) gOk++;
    if (isPlausibleCif(t)) tOk++;
    if (g && t && g === t) same++;
    if (isPlausibleCif(g) || isPlausibleCif(t)) anyCif++;
    if (cleanStr(r[C.gSap])) gSapOk++;
    if (cleanStr(r[C.tSap])) tSapOk++;
  }
  console.log(`   CIF: gestor ${pct(gOk, n)}  titular ${pct(tOk, n)}  alguno ${pct(anyCif, n)}  gestor==titular ${pct(same, n)}`);
  console.log(`   SAP: gestor ${pct(gSapOk, n)}  titular ${pct(tSapOk, n)}`);

  // 5) Facturas/órdenes (col 12): multivalor
  let fEmpty = 0, f1 = 0, fMulti = 0, totalDocs = 0;
  const sampleDocs: string[] = [];
  for (const r of data) {
    const v = cleanStr(r[C.facturas]);
    if (!v) { fEmpty++; continue; }
    const docs = v.split(/[;,\s]+/).map(x => x.replace(/\D/g, '')).filter(Boolean);
    totalDocs += docs.length;
    if (docs.length === 0) fEmpty++;
    else if (docs.length === 1) f1++;
    else fMulti++;
    if (sampleDocs.length < 5 && docs[0]) sampleDocs.push(docs[0]);
  }
  console.log(`   Docs (col12): vacío ${pct(fEmpty, n)}  1 doc ${pct(f1, n)}  multi ${pct(fMulti, n)}  (total docs=${totalDocs})  ej: ${sampleDocs.join(', ')}`);

  // 6) Identidad de activo candidata
  const k1 = new Set<string>(); // instName|cp
  const k2 = new Set<string>(); // emplName|instName|cp
  const k3 = new Set<string>(); // emplName|instName|addr|cp
  for (const r of data) {
    const empl = cleanStr(r[C.emplName]) ?? '';
    const inst = cleanStr(r[C.instName]) ?? '';
    const addr = cleanStr(r[C.addr]) ?? '';
    const cp = cleanStr(r[C.cp]) ?? '';
    k1.add(`${inst}|${cp}`);
    k2.add(`${empl}|${inst}|${cp}`);
    k3.add(`${empl}|${inst}|${addr}|${cp}`);
  }
  console.log(`   Activos candidatos: (inst|cp)=${k1.size}  (empl|inst|cp)=${k2.size}  (empl|inst|addr|cp)=${k3.size}  → ratio insp/activo=${(n / k2.size).toFixed(2)}`);

  // 7) Muestras para validar contra BD
  const sampleRow = data[0]!;
  console.log(`   Muestra fila0: cod=${cleanStr(sampleRow[C.cod])}  gSap=${cleanStr(sampleRow[C.gSap])}  tSap=${cleanStr(sampleRow[C.tSap])}  pedido=${cleanStr(sampleRow[C.pedido])}`);
}
