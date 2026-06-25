/**
 * Parser para data/raw/Profit centers.xls.
 *
 * El fichero no es un .xls real — es un MHTML exportado por SAP/Excel. Estructura:
 *   - cabecera MIME (`MIME-Version: 1.0`)
 *   - cuerpo HTML codificado en quoted-printable (UTF-8)
 *   - varias <table> separadas; los datos están en la tabla 6 (0-indexed)
 *
 * Columnas (10 por fila tras la cabecera, mapeo posicional):
 *   0: company_code     (0135, 0136, 0158, 0359, 0380, 0442, K999)
 *   1: company_name     (TÜV SÜD ATISAE S.A.U., …)
 *   2: country_code     (ES)
 *   3: country_name     (Spain)
 *   4: division_code    (II, MO, NGB, BA, PS)
 *   5: business_line    (II BLS BEM, MO RET REI, …)  — sub-BU dentro de la BU funcional
 *   6: business_unit    ("II - Building Lifecycle Services", …)
 *   7: profit_center_code  (0001/13500161)
 *   8: profit_center_name  (ATI RI BEM Madrid)
 *   9: number_of_records
 *
 * Notas:
 *   - K999 (Konsolidierung V1-CON) es entidad contable de consolidación → excluir.
 *   - Una BU funcional aparece varias veces (una por cada profit center). Hay que deduplicar.
 */

import { readFileSync } from 'node:fs';

const EXCLUDED_COMPANY_CODES = new Set(['K999']);

export type ProfitCenterRow = {
  companyCode: string;
  companyName: string;
  countryCode: string;
  countryName: string;
  divisionCode: string;
  businessLine: string;
  businessUnit: string;
  profitCenterCode: string;
  profitCenterName: string;
};

/** Decodifica quoted-printable a UTF-8 (implementación mínima suficiente para este fichero). */
function decodeQuotedPrintable(input: string): string {
  // 1) Quitar soft line breaks: =\r?\n
  const noSoftBreaks = input.replace(/=\r?\n/g, '');
  // 2) Sustituir =XX por su byte y reinterpretar como UTF-8
  const bytes: number[] = [];
  for (let i = 0; i < noSoftBreaks.length; i++) {
    const c = noSoftBreaks[i]!;
    if (c === '=' && i + 2 < noSoftBreaks.length) {
      const hex = noSoftBreaks.substring(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    bytes.push(c.charCodeAt(0));
  }
  return Buffer.from(bytes).toString('utf8');
}

/** Extrae texto plano de una celda HTML (quita tags, decodifica entidades). */
function cleanCell(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    // Entidades numéricas decimal &#NNN; (incluido &#32; espacio)
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    // Entidades numéricas hexadecimales &#xNN;
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    // Entidades nombradas comunes
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

/**
 * Lee el MHTML, extrae las filas de la tabla 6 y devuelve solo las operativas.
 * @param path Ruta al fichero (típicamente `data/raw/Profit centers.xls`)
 */
export function parseProfitCenters(path: string): ProfitCenterRow[] {
  const raw = readFileSync(path, 'latin1'); // quoted-printable es ASCII; el contenido real es UTF-8 tras decodificar
  const decoded = decodeQuotedPrintable(raw);

  // Extraer todas las tablas
  const tableRegex = /<table[\s\S]*?<\/table>/gi;
  const tables = [...decoded.matchAll(tableRegex)].map(m => m[0]);
  if (tables.length < 7) {
    throw new Error(`Profit centers MHTML inválido: esperaba ≥7 tablas, encontré ${tables.length}`);
  }
  const dataTable = tables[6]!;

  // Extraer filas de la tabla de datos
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const allRows: string[][] = [];
  for (const trMatch of dataTable.matchAll(trRegex)) {
    const tr = trMatch[1]!;
    const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c => cleanCell(c[1]!));
    allRows.push(cells);
  }

  // Saltar la cabecera (primera fila)
  const dataRows = allRows.slice(1);

  const result: ProfitCenterRow[] = [];
  for (const row of dataRows) {
    if (row.length < 9) continue; // filas malformadas
    const companyCode = row[0]!.trim();
    if (EXCLUDED_COMPANY_CODES.has(companyCode)) continue;

    result.push({
      companyCode,
      companyName: row[1]!.trim(),
      countryCode: row[2]!.trim(),
      countryName: row[3]!.trim(),
      divisionCode: row[4]!.trim(),
      businessLine: row[5]!.trim(),
      businessUnit: row[6]!.trim(),
      profitCenterCode: row[7]!.trim(),
      profitCenterName: row[8]!.trim(),
    });
  }

  if (result.length === 0) {
    throw new Error('No se extrajo ninguna fila operativa de Profit centers.xls');
  }
  return result;
}