/**
 * Normalización del identificador de usuario (sAMAccountName).
 *
 * Vive en su propio módulo SIN secretos a propósito: es un helper puro que pueden
 * importar tanto módulos server-side con secretos (auth, ad-soap) como, llegado el
 * caso, código de cliente, sin arrastrar `AD_SOAP_LDAP_KEY` ni `DATABASE_URL` al
 * bundle del navegador.
 */

/**
 * Normaliza la entrada de usuario a su sAMAccountName en minúsculas:
 * "WW001\defru-li" o "defru-li@tuvsud.com" → "defru-li".
 * El match contra APP_USERS es case-insensitive (collation MySQL por defecto),
 * pero el alta guarda ya el identificador normalizado para no depender de ella.
 */
export function normalizeUsername(raw: string): string {
  let u = raw.toLowerCase().trim();
  if (u.includes('\\')) u = u.split('\\')[1] ?? u;
  else if (u.includes('@')) u = u.split('@')[0] ?? u;
  return u.trim();
}
