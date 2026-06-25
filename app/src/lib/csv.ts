/**
 * Construcción segura de celdas CSV — fuente ÚNICA compartida por las rutas de
 * exportación (clientes, oportunidades, auditoría).
 *
 * Aplica dos protecciones:
 *  1. Entrecomillado RFC-4180: si el valor contiene el separador (`;`/`,`), una
 *     comilla o un salto de línea, se envuelve entre comillas y se duplican las
 *     comillas internas.
 *  2. Neutralización de inyección de fórmulas (CSV/Formula Injection, CWE-1236):
 *     si el valor empieza por un carácter que Excel/LibreOffice interpretan como
 *     fórmula (`=` `+` `-` `@`, TAB 0x09 o CR 0x0D), se antepone un apóstrofo para
 *     forzar a que se trate como texto. Campos como `legal_name`, `username` o
 *     `user_agent` pueden contener texto influido por un atacante (p. ej. el
 *     usuario de un intento de login fallido), de modo que abrir el CSV no debe
 *     ejecutar nada. Ver OWASP "CSV Injection".
 *
 * Los valores puramente numéricos (incl. negativos y con coma decimal española)
 * se dejan intactos: un importe `-1234,56` no es una fórmula y no debe corromperse.
 */

/** ¿El string es un número (entero/decimal, con `.`/`,`, opcional signo `-`)? */
function looksNumeric(s: string): boolean {
  return /^-?\d+(?:[.,]\d+)*$/.test(s);
}

/** ¿El primer carácter es un disparador de fórmula de hoja de cálculo? */
function startsWithFormulaTrigger(s: string): boolean {
  const c = s.charCodeAt(0);
  // '='(61) '+'(43) '-'(45) '@'(64) TAB(9) CR(13)
  return c === 61 || c === 43 || c === 45 || c === 64 || c === 9 || c === 13;
}

export function csvCell(v: unknown): string {
  if (v == null) return '';

  let s: string;
  if (v instanceof Date) s = v.toISOString().slice(0, 10);
  else if (typeof v === 'object') s = JSON.stringify(v);
  else s = String(v);

  // Neutralizar fórmulas: prefijo de apóstrofo si arranca por un carácter peligroso
  // y NO es un número legítimo (los importes negativos empiezan por '-' y se conservan).
  if (startsWithFormulaTrigger(s) && !looksNumeric(s)) {
    s = `'${s}`;
  }

  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
