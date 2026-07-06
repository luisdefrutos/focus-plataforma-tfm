/**
 * Catálogo de tipos de evento de auditoría — fuente ÚNICA compartida por los
 * loggers (que escriben en AUDIT_EVENTS) y la UI de /auditoria (que los muestra y
 * filtra). Los tipos se guardan como string (no enum nativo) para poder añadir
 * nuevos sin migración de esquema; este catálogo aporta la categoría y la
 * etiqueta legible en español.
 */

export type AuditCategory = 'AUTH' | 'EXPORT' | 'IAM';
export type AuditOutcome = 'SUCCESS' | 'FAILURE';

export type AuditEventMeta = {
  category: AuditCategory;
  /** Etiqueta legible en español para la UI. */
  label: string;
};

/** Tipos de evento conocidos. Añadir aquí basta para que la UI los etiquete/filtre. */
export const AUDIT_EVENTS = {
  LOGIN_SUCCESS:        { category: 'AUTH',   label: 'Inicio de sesión' },
  LOGIN_FAILED:         { category: 'AUTH',   label: 'Intento de inicio de sesión fallido' },
  LOGOUT:               { category: 'AUTH',   label: 'Cierre de sesión' },
  EXPORT_CLIENTES:      { category: 'EXPORT', label: 'Exportación de clientes (CSV)' },
  EXPORT_OPORTUNIDADES: { category: 'EXPORT', label: 'Exportación de oportunidades (CSV)' },
  EXPORT_AUDITORIA:     { category: 'EXPORT', label: 'Exportación del registro de auditoría (CSV)' },
  USER_CREATED:           { category: 'IAM',    label: 'Alta de usuario' },
  USER_ROLE_CHANGED:      { category: 'IAM',    label: 'Cambio de rol de usuario' },
  USER_FILTERS_CHANGED:   { category: 'IAM',    label: 'Cambio de filtros de usuario' },
  USER_DEACTIVATED:       { category: 'IAM',    label: 'Baja lógica de usuario' },
  ROLE_MODULES_CHANGED:   { category: 'IAM',    label: 'Módulos de rol actualizados' },
  AUTHZ_DENIED:           { category: 'IAM',    label: 'Acceso denegado (sin permiso)' },
} as const satisfies Record<string, AuditEventMeta>;

export type AuditEventType = keyof typeof AUDIT_EVENTS;

/** Etiquetas legibles de las categorías (para filtros y chips de la UI). */
export const AUDIT_CATEGORY_LABELS: Record<AuditCategory, string> = {
  AUTH: 'Autenticación',
  EXPORT: 'Exportación',
  IAM: 'Administración',
};

/**
 * Endpoint de exportación asociado a cada evento EXPORT. Permite "reexportar" desde
 * el visor de auditoría: se reconstruye la URL de export con los filtros guardados en
 * `metadata.filters` del evento. Solo los eventos listados aquí son reexportables.
 */
export const EXPORT_ENDPOINTS: Partial<Record<AuditEventType, string>> = {
  EXPORT_CLIENTES: '/api/clientes/export',
  EXPORT_OPORTUNIDADES: '/api/oportunidades/export',
  EXPORT_AUDITORIA: '/api/auditoria/export',
};

/** Endpoint de exportación de un tipo de evento, o undefined si no es reexportable. */
export function getExportEndpoint(type: string): string | undefined {
  return EXPORT_ENDPOINTS[type as AuditEventType];
}

/** Metadatos de un tipo de evento (categoría + etiqueta), o undefined si no está catalogado. */
export function getEventMeta(type: string): AuditEventMeta | undefined {
  return (AUDIT_EVENTS as Record<string, AuditEventMeta>)[type];
}

/** Etiqueta legible de un tipo de evento; si no está catalogado, devuelve el propio código. */
export function getEventLabel(type: string): string {
  return getEventMeta(type)?.label ?? type;
}
