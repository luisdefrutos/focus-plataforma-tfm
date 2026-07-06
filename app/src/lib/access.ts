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
  /** Códigos SAP de sociedades permitidas (ej. "0135", "0136"). */
  entities?: string[];
  /** Códigos de división permitidos (ej. "II", "MO"). */
  divisions?: string[];
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
  /** Códigos CNAE permitidos. */
  cnaes?: string[];
  /** Códigos de rango de importe permitidos. */
  amountRanges?: string[];
  /** Valores de intercompany permitidos ('0' = externo, '1' = intercompany). */
  intercompany?: ('0' | '1')[];
};

/**
 * Códigos de los módulos (pantallas) de la aplicación.
 * Un usuario que NO tenga un módulo en su lista no puede verlo en el sidebar
 * ni acceder a su ruta directamente (el layout lo redirige a /dashboard).
 * Si `allowedModules` es undefined / vacío → acceso total (superusuario).
 */
export const ALL_MODULES = [
  'MODULE_DASHBOARD',
  'MODULE_CLIENTES',
  'MODULE_OPORTUNIDADES',
  'MODULE_TOP_CLIENTES',
  'MODULE_SEGMENTACION',
  'MODULE_CATALOGO',
  'MODULE_AUDITORIA',
] as const;

export type ModuleCode = typeof ALL_MODULES[number];

/** Metadatos de cada módulo para la UI de administración. */
export const MODULE_META: Record<ModuleCode, { label: string; icon: string; route: string }> = {
  MODULE_DASHBOARD:      { label: 'Dashboard',     icon: 'dashboard',   route: '/dashboard' },
  MODULE_CLIENTES:       { label: 'Buscador 360',  icon: 'search',      route: '/clientes' },
  MODULE_OPORTUNIDADES:  { label: 'Oportunidades', icon: 'table_chart', route: '/oportunidades' },
  MODULE_TOP_CLIENTES:   { label: 'Top Clientes',  icon: 'star',        route: '/top-clientes' },
  MODULE_SEGMENTACION:   { label: 'Segmentación',  icon: 'pie_chart',   route: '/segmentacion' },
  MODULE_CATALOGO:       { label: 'Catálogo',      icon: 'list',        route: '/catalogo' },
  MODULE_AUDITORIA:      { label: 'Auditoría',     icon: 'history',     route: '/auditoria' },
};
