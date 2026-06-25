/**
 * Seed: PRODUCT_CATALOG.
 * Fuente: data/raw/Table_MATERIALS.xlsx — 492 servicios con LE/DIVISION/BUSINESS LINE.
 *
 * Columnas:
 *   MATERIAL CODE, LE, DIVISION, BUSINESS LINE,
 *   DESCRIPTION (EN), DESCRIPCION (ES),
 *   TÜV SERVICE CODE, TÜV SERVICE NAME, OBJECTS CODE, OBJECTS NAME,
 *   LOCATION/PROCESSES CODE, LOCATION/PROCESSES NAME, SUBITEM CODE,
 *   TÜV PRODUCT CODE, TÜV PRODUCT NAME
 *
 * Idempotente por material_code. Si un MATERIAL CODE aparece varias veces (mismo material
 * en distintas LE), conservamos solo la primera ocurrencia — el catálogo lógico es por
 * material, la asociación a LE/BU vive en BILLING_RECORDS.
 */

import { prisma, SEED_AUDIT } from './lib/prisma';
import * as XLSX from 'xlsx';
import { resolve } from 'node:path';

type Row = {
  'MATERIAL CODE'?: string;
  LE?: string;
  DIVISION?: string;
  'BUSINESS LINE'?: string;
  'DESCRIPTION (EN)'?: string;
  'DESCRIPCION (ES)'?: string;
  'TÜV SERVICE CODE'?: string;
  'TÜV SERVICE NAME'?: string;
  'TÜV PRODUCT CODE'?: string;
  'TÜV PRODUCT NAME'?: string;
};

const str = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

export async function seedProductCatalog(): Promise<void> {
  const path = resolve(__dirname, '../../../data/raw/Table_MATERIALS.xlsx');
  console.log(`📂 Leyendo ${path}…`);
  const wb = XLSX.readFile(path);
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  const rows: Row[] = XLSX.utils.sheet_to_json(sheet!);
  console.log(`   ${rows.length} filas leídas.`);

  // Dedupe por MATERIAL CODE: nos quedamos con la primera ocurrencia
  const byMaterial = new Map<string, Row>();
  for (const r of rows) {
    const code = str(r['MATERIAL CODE']);
    if (!code) continue;
    if (!byMaterial.has(code)) byMaterial.set(code, r);
  }
  console.log(`   ${byMaterial.size} servicios únicos (deduplicados por MATERIAL CODE).`);

  console.log(`\n📦 Cargando PRODUCT_CATALOG…`);
  let created = 0;
  let skipped = 0;
  for (const [code, r] of byMaterial) {
    const descEn = str(r['DESCRIPTION (EN)']);
    if (!descEn) {
      skipped++;
      continue; // description_en es NOT NULL
    }

    await prisma.productCatalog.upsert({
      where: { materialCode: code },
      update: {
        descriptionEn: descEn,
        descriptionEs: str(r['DESCRIPCION (ES)']) ?? undefined,
        serviceCode: str(r['TÜV SERVICE CODE']) ?? undefined,
        serviceName: str(r['TÜV SERVICE NAME']) ?? undefined,
        productCode: str(r['TÜV PRODUCT CODE']) ?? undefined,
        productName: str(r['TÜV PRODUCT NAME']) ?? undefined,
        category: str(r['BUSINESS LINE']) ?? undefined,
      },
      create: {
        materialCode: code,
        descriptionEn: descEn,
        descriptionEs: str(r['DESCRIPCION (ES)']),
        serviceCode: str(r['TÜV SERVICE CODE']),
        serviceName: str(r['TÜV SERVICE NAME']),
        productCode: str(r['TÜV PRODUCT CODE']),
        productName: str(r['TÜV PRODUCT NAME']),
        category: str(r['BUSINESS LINE']),
        ...SEED_AUDIT,
      },
    });
    created++;
  }
  console.log(`   ✔ ${created} servicios cargados${skipped > 0 ? `, ${skipped} saltados (sin description_en)` : ''}.`);
}

if (require.main === module) {
  seedProductCatalog()
    .then(() => prisma.$disconnect())
    .catch(err => {
      console.error(err);
      prisma.$disconnect();
      process.exit(1);
    });
}