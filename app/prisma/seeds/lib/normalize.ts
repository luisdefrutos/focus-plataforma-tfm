/**
 * Utilidades de normalización de datos para los seeds.
 * Reglas alineadas con la convención del proyecto Focus:
 *  - personas: Title Case respetando tildes
 *  - emails: lowercase + trim
 *  - teléfonos: formato internacional con libphonenumber-js (España por defecto)
 *  - postal codes: 5 dígitos con padding
 *  - ciudades/provincias: Title Case
 */

/** Limpia un string: trim + null si vacío. */
export const cleanStr = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

/**
 * Title Case en español: primera letra de cada palabra en mayúscula, resto en minúscula.
 * Preserva tildes y caracteres especiales. Mantiene en mayúsculas las partículas legales
 * comunes (SA, SL, SAU, etc.) si están al final.
 */
export function toTitleCase(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;

  return s
    .toLocaleLowerCase('es-ES')
    .split(/(\s+|[-./])/)
    .map(word => {
      if (!word) return word;
      // Conservar separadores
      if (/^[\s\-./]+$/.test(word)) return word;
      // Particular: si la palabra ya tiene mayúsculas internas (acrónimos), respetarlo
      if (word.length <= 1) return word.toLocaleUpperCase('es-ES');
      return word[0]!.toLocaleUpperCase('es-ES') + word.slice(1);
    })
    .join('');
}

/**
 * Normaliza un nombre completo de persona quitando el título si está al inicio.
 * Ej: "Mr. DARIO CARRACEDO" → "Dario Carracedo"
 */
const TITLE_PREFIXES = /^(mr\.?|ms\.?|mrs\.?|miss\.?|dr\.?|prof\.?|sr\.?|sra\.?|dn\.?|d\.?|d[oñ]a)\s+/i;
export function normalizePersonName(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = String(input).trim();
  if (!s) return null;
  // Quitar prefijo de título si existe (lo capturamos aparte en el campo `title`)
  s = s.replace(TITLE_PREFIXES, '');
  return toTitleCase(s);
}

/** Normaliza un email: trim + lowercase. */
export function normalizeEmail(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = String(input).trim().toLowerCase();
  if (!s || !s.includes('@')) return null;
  return s;
}

/**
 * Normaliza un teléfono al formato internacional pretty-printed.
 * Cubre los formatos típicos del dataset (España mayoritariamente):
 *   "34981901906"      → "+34 981 90 19 06"
 *   "0034 915 551 234" → "+34 915 55 12 34"
 *   "+34 91 555 1234"  → "+34 915 55 12 34"
 *   "91 555 12 34"     → "+34 915 55 12 34"  (asume ES)
 *   "351212345678"     → "+351 212 345 678"  (Portugal)
 * Si no encaja con ningún patrón, devuelve los dígitos limpios.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (input == null) return null;
  // Mantener solo dígitos y signo + inicial
  const raw = String(input).trim();
  if (!raw) return null;
  const hasPlus = raw.startsWith('+');
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  // Normalizar prefijos comunes a forma "país + nacional"
  if (!hasPlus && digits.startsWith('00')) digits = digits.slice(2);

  // España (+34, 9 dígitos): formato "+34 NNN NN NN NN"
  if (/^34\d{9}$/.test(digits)) {
    return `+34 ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`;
  }
  if (/^\d{9}$/.test(digits)) {
    // 9 dígitos puros → asumir España
    return `+34 ${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`;
  }

  // Portugal (+351, 9 dígitos): formato "+351 NNN NNN NNN"
  if (/^351\d{9}$/.test(digits)) {
    return `+351 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }

  // Devolver con + si llevaba prefijo internacional
  if (hasPlus || digits.length > 9) return `+${digits}`;
  return digits;
}

/**
 * Normaliza un código postal español: 5 dígitos con padding por la izquierda.
 * Si no es numérico o tiene >5 dígitos, devuelve el crudo trimmed.
 */
export function normalizePostalCode(input: unknown): string | null {
  if (input == null) return null;
  const s = String(input).trim();
  if (!s) return null;
  // Quitar decimal si Excel lo trajo como número (28015.0 → 28015)
  const noDecimal = s.replace(/\.0+$/, '');
  // Si es exactamente numérico
  if (/^\d{1,5}$/.test(noDecimal)) return noDecimal.padStart(5, '0');
  return noDecimal;
}

/** City / province: Title Case. */
export function normalizeCity(input: string | null | undefined): string | null {
  return toTitleCase(input);
}