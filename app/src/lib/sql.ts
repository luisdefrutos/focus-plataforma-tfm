/**
 * Utilidades de SQL crudo compartidas por las queries de `@/lib/queries`.
 */

/**
 * Escapa los metacaracteres de LIKE (`\` `%` `_`) en texto de usuario para que se
 * traten como literales. Evita que un patrón como `%` o `_` fuerce escaneos
 * completos no sargables / cambie la semántica de un prefijo (CWE-405). El valor
 * sigue viajando como parámetro `?`; el escape va dentro del propio valor (MySQL
 * usa `\` como carácter de escape de LIKE por defecto). NO es una protección de
 * SQLi (eso lo da el placeholder `?`), sino de corrección de la búsqueda.
 */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, m => '\\' + m);
}
