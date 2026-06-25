/**
 * Helpers de derivación geográfica y fiscal para España.
 *
 * - Provincia ← primeros 2 dígitos del código postal (NN-NNN).
 * - CCAA      ← mapping provincia → comunidad autónoma.
 * - Tipo de entidad ← primer carácter del CIF/NIF.
 *
 * Las constantes se mantienen en server-only para usarlas tanto en queries
 * como en presentación (componer SELECT CASE en SQL o badges en UI).
 */

// ─── Provincia (código postal NN → provincia) ─────────────────────────
// Mapa oficial INE. NN 01..52 cubre las 50 provincias + Ceuta(51) + Melilla(52).

export const PROVINCE_BY_PC2: Record<string, string> = {
  '01': 'Álava',
  '02': 'Albacete',
  '03': 'Alicante',
  '04': 'Almería',
  '05': 'Ávila',
  '06': 'Badajoz',
  '07': 'Illes Balears',
  '08': 'Barcelona',
  '09': 'Burgos',
  '10': 'Cáceres',
  '11': 'Cádiz',
  '12': 'Castellón',
  '13': 'Ciudad Real',
  '14': 'Córdoba',
  '15': 'A Coruña',
  '16': 'Cuenca',
  '17': 'Girona',
  '18': 'Granada',
  '19': 'Guadalajara',
  '20': 'Gipuzkoa',
  '21': 'Huelva',
  '22': 'Huesca',
  '23': 'Jaén',
  '24': 'León',
  '25': 'Lleida',
  '26': 'La Rioja',
  '27': 'Lugo',
  '28': 'Madrid',
  '29': 'Málaga',
  '30': 'Murcia',
  '31': 'Navarra',
  '32': 'Ourense',
  '33': 'Asturias',
  '34': 'Palencia',
  '35': 'Las Palmas',
  '36': 'Pontevedra',
  '37': 'Salamanca',
  '38': 'Santa Cruz de Tenerife',
  '39': 'Cantabria',
  '40': 'Segovia',
  '41': 'Sevilla',
  '42': 'Soria',
  '43': 'Tarragona',
  '44': 'Teruel',
  '45': 'Toledo',
  '46': 'Valencia',
  '47': 'Valladolid',
  '48': 'Bizkaia',
  '49': 'Zamora',
  '50': 'Zaragoza',
  '51': 'Ceuta',
  '52': 'Melilla',
};

// ─── CCAA (provincia → comunidad autónoma) ─────────────────────────────

export const CCAA_BY_PROVINCE: Record<string, string> = {
  // Andalucía
  'Almería': 'Andalucía', 'Cádiz': 'Andalucía', 'Córdoba': 'Andalucía',
  'Granada': 'Andalucía', 'Huelva': 'Andalucía', 'Jaén': 'Andalucía',
  'Málaga': 'Andalucía', 'Sevilla': 'Andalucía',
  // Aragón
  'Huesca': 'Aragón', 'Teruel': 'Aragón', 'Zaragoza': 'Aragón',
  // Asturias
  'Asturias': 'Asturias',
  // Illes Balears
  'Illes Balears': 'Illes Balears',
  // Canarias
  'Las Palmas': 'Canarias', 'Santa Cruz de Tenerife': 'Canarias',
  // Cantabria
  'Cantabria': 'Cantabria',
  // Castilla y León
  'Ávila': 'Castilla y León', 'Burgos': 'Castilla y León',
  'León': 'Castilla y León', 'Palencia': 'Castilla y León',
  'Salamanca': 'Castilla y León', 'Segovia': 'Castilla y León',
  'Soria': 'Castilla y León', 'Valladolid': 'Castilla y León',
  'Zamora': 'Castilla y León',
  // Castilla-La Mancha
  'Albacete': 'Castilla-La Mancha', 'Ciudad Real': 'Castilla-La Mancha',
  'Cuenca': 'Castilla-La Mancha', 'Guadalajara': 'Castilla-La Mancha',
  'Toledo': 'Castilla-La Mancha',
  // Catalunya
  'Barcelona': 'Catalunya', 'Girona': 'Catalunya',
  'Lleida': 'Catalunya', 'Tarragona': 'Catalunya',
  // C. Valenciana
  'Alicante': 'C. Valenciana', 'Castellón': 'C. Valenciana', 'Valencia': 'C. Valenciana',
  // Extremadura
  'Badajoz': 'Extremadura', 'Cáceres': 'Extremadura',
  // Galicia
  'A Coruña': 'Galicia', 'Lugo': 'Galicia',
  'Ourense': 'Galicia', 'Pontevedra': 'Galicia',
  // Madrid
  'Madrid': 'C. de Madrid',
  // Murcia
  'Murcia': 'R. de Murcia',
  // Navarra
  'Navarra': 'C.F. de Navarra',
  // País Vasco
  'Álava': 'País Vasco', 'Bizkaia': 'País Vasco', 'Gipuzkoa': 'País Vasco',
  // La Rioja
  'La Rioja': 'La Rioja',
  // Ciudades autónomas
  'Ceuta': 'Ceuta',
  'Melilla': 'Melilla',
};

/** Lista única ordenada de CCAA para usar en selects. */
export const CCAAS: string[] = Array.from(new Set(Object.values(CCAA_BY_PROVINCE))).sort();

/** Códigos PC2 que pertenecen a una CCAA — para WHERE LEFT(postal_code,2) IN (...). */
export function pc2CodesForCcaa(ccaa: string): string[] {
  const provinces = Object.entries(CCAA_BY_PROVINCE)
    .filter(([, c]) => c === ccaa)
    .map(([p]) => p);
  return Object.entries(PROVINCE_BY_PC2)
    .filter(([, p]) => provinces.includes(p))
    .map(([code]) => code);
}

/** Códigos PC2 que pertenecen a una provincia. */
export function pc2CodesForProvince(province: string): string[] {
  return Object.entries(PROVINCE_BY_PC2)
    .filter(([, p]) => p === province)
    .map(([code]) => code);
}

/** Provincias ordenadas. */
export const PROVINCES: string[] = Array.from(new Set(Object.values(PROVINCE_BY_PC2))).sort();

// ─── Tipo de entidad (letra inicial del CIF/NIF) ───────────────────────
// AEAT — letras del NIF/CIF de personas jurídicas.

export type EntityType = {
  code: string;          // letra (A, B, …) o '9'..'0' (NIF) o 'NIE' (X/Y/Z) o 'EXTRANJERO' o 'NA'
  label: string;
};

export const ENTITY_TYPES: EntityType[] = [
  { code: 'A', label: 'Sociedad anónima' },
  { code: 'B', label: 'Sociedad limitada' },
  { code: 'C', label: 'Sociedad colectiva' },
  { code: 'D', label: 'Sociedad comanditaria' },
  { code: 'E', label: 'Comunidad de bienes' },
  { code: 'F', label: 'Sociedad cooperativa' },
  { code: 'G', label: 'Asociación/fundación' },
  { code: 'H', label: 'Comunidad de propietarios' },
  { code: 'J', label: 'Sociedad civil' },
  { code: 'N', label: 'Entidad extranjera (no residente)' },
  { code: 'P', label: 'Corporación local' },
  { code: 'Q', label: 'Organismo público' },
  { code: 'R', label: 'Congregación religiosa' },
  { code: 'S', label: 'Órgano de la Administración' },
  { code: 'U', label: 'UTE' },
  { code: 'V', label: 'Otros (Coop. Crédito, etc.)' },
  { code: 'W', label: 'Establecimiento permanente' },
  { code: 'NIF', label: 'Particular (DNI)' },
  { code: 'NIE', label: 'Particular (NIE)' },
  { code: 'EXTRANJERO', label: 'Empresa extranjera' },
  { code: 'NA', label: 'Sin asignar' },
];

/** Mapea letra de CIF → código canónico de tipo de entidad. */
export function classifyEntity(taxId: string | null | undefined): string {
  if (!taxId || taxId === 'Not assigned') return 'NA';
  // Tax ID empieza con código país (ES, FR, DE, etc.) o sin prefijo.
  // Si no es ES → extranjera.
  if (taxId.length >= 2 && /^[A-Z]{2}/.test(taxId) && !taxId.startsWith('ES')) {
    return 'EXTRANJERO';
  }
  const body = taxId.startsWith('ES') ? taxId.slice(2) : taxId;
  const ch = body[0]?.toUpperCase() ?? '';
  if (/[0-9]/.test(ch)) return 'NIF';
  if (ch === 'X' || ch === 'Y' || ch === 'Z') return 'NIE';
  const known = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'N', 'P', 'Q', 'R', 'S', 'U', 'V', 'W']);
  return known.has(ch) ? ch : 'NA';
}

/**
 * Construye un fragmento SQL `CASE` que clasifica un tax_id a su código canónico.
 * Se usa para tanto SELECT (proyectar) como WHERE (filtrar).
 */
export const SQL_ENTITY_TYPE_EXPR = `
CASE
  WHEN c.tax_id IS NULL OR c.tax_id = 'Not assigned' THEN 'NA'
  WHEN c.tax_id LIKE 'ES%' AND SUBSTRING(c.tax_id, 3, 1) REGEXP '^[0-9]$' THEN 'NIF'
  WHEN c.tax_id LIKE 'ES%' AND SUBSTRING(c.tax_id, 3, 1) IN ('X','Y','Z') THEN 'NIE'
  WHEN c.tax_id LIKE 'ES%' AND SUBSTRING(c.tax_id, 3, 1) IN ('A','B','C','D','E','F','G','H','J','N','P','Q','R','S','U','V','W')
       THEN SUBSTRING(c.tax_id, 3, 1)
  WHEN c.tax_id NOT LIKE 'ES%' AND c.tax_id REGEXP '^[A-Z]{2}' THEN 'EXTRANJERO'
  ELSE 'NA'
END
`.trim();

// ─── Rangos de facturación (Table_RANGES equivalente) ──────────────────

export type AmountRange = {
  code: string;
  label: string;
  min: number;
  max: number | null;   // null = sin tope
};

export const AMOUNT_RANGES: AmountRange[] = [
  { code: 'r0',         label: 'Sin facturar',         min: 0,        max: 0 },
  { code: 'r0_1k',      label: '0,01 € — 1.000 €',     min: 0.01,     max: 1_000 },
  { code: 'r1k_5k',     label: '1.000 € — 5.000 €',    min: 1_000,    max: 5_000 },
  { code: 'r5k_10k',    label: '5.000 € — 10.000 €',   min: 5_000,    max: 10_000 },
  { code: 'r10k_50k',   label: '10.000 € — 50.000 €',  min: 10_000,   max: 50_000 },
  { code: 'r50k_100k',  label: '50.000 € — 100.000 €', min: 50_000,   max: 100_000 },
  { code: 'r100k_500k', label: '100.000 € — 500.000 €',min: 100_000,  max: 500_000 },
  { code: 'r500k_plus', label: '> 500.000 €',          min: 500_000,  max: null },
];

/** SQL CASE para clasificar `total_amount` en un rango. Recibe el alias de la columna agg. */
export function sqlRangeCase(amountCol: string): string {
  return `
CASE
  WHEN ${amountCol} IS NULL OR ${amountCol} = 0 THEN 'r0'
  WHEN ${amountCol} <= 1000 THEN 'r0_1k'
  WHEN ${amountCol} <= 5000 THEN 'r1k_5k'
  WHEN ${amountCol} <= 10000 THEN 'r5k_10k'
  WHEN ${amountCol} <= 50000 THEN 'r10k_50k'
  WHEN ${amountCol} <= 100000 THEN 'r50k_100k'
  WHEN ${amountCol} <= 500000 THEN 'r100k_500k'
  ELSE 'r500k_plus'
END
`.trim();
}

// ─── Intercompany ──────────────────────────────────────────────────────
// Un cliente es "intercompany" si su razón social pertenece al grupo TÜV LFD ES.
// Patrones extraídos de LEGAL_ENTITIES: TÜV/TUV, INSPECCION_SA, Swissi, Ctva.

export const SQL_INTERCOMPANY_EXPR = `
CASE
  WHEN c.legal_name LIKE '%TÜV%' OR c.legal_name LIKE '%TUV %'
       OR c.legal_name LIKE '%INSPECCION_SA%' OR c.legal_name LIKE '%Swissi%'
       OR c.legal_name LIKE '%Ctva Ingenieria%'
  THEN 1 ELSE 0
END
`.trim();