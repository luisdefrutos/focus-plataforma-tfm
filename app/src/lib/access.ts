/**
 * RLS por filtros granulares (`allowed_filters` JSON por usuario).
 *
 * Listas blancas por dimensión que se intersecan con los filtros pedidos por el
 * usuario. Si una dimensión está definida, el usuario sólo puede ver esos valores;
 * si está ausente (undefined), no hay restricción en esa dimensión.
 *
 * Tipo compartido por: el callback de sesión (auth.ts), la augmentación de tipos de
 * next-auth (types/next-auth.d.ts) y las queries que aplican el alcance (queries/customers.ts).
 */

/**
 * Sentinela que fuerza un resultado vacío cuando, tras intersecar, el usuario no
 * tiene acceso a NINGUNO de los valores pedidos en una dimensión. Se inyecta como
 * valor de filtro imposible (no puede coincidir con un código real de CCAA,
 * provincia, material, etc.).
 */
export const FORCED_EMPTY = '__FORCED_EMPTY__';

/** Listas blancas por dimensión almacenadas en `APP_USERS.allowed_filters` (JSON). */
export type AllowedFilters = {
  /** Códigos de comunidad autónoma permitidos. */
  ccaas?: string[];
  /** Provincias permitidas. */
  provinces?: string[];
  /** Tipos de entidad (letra del CIF/NIF/…) permitidos. */
  entityTypes?: string[];
  /** Centros de coste (profit center) permitidos. */
  profitCenters?: string[];
  /** Materiales/servicios permitidos. */
  materials?: string[];
  /** Códigos de rango de importe permitidos. */
  amountRanges?: string[];
  /** Valores de intercompany permitidos ('0' = externo, '1' = intercompany). */
  intercompany?: ('0' | '1')[];
};
