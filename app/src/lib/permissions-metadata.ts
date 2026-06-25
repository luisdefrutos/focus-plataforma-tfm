export type PermissionType = 'read' | 'write' | 'admin';

export interface PermissionMeta {
  type: PermissionType;
  icon: string;
  module: string;
  shortLabel: string;
  capabilities: string[];
}

export const PERMISSION_METADATA: Record<string, PermissionMeta> = {
  'IAM_MANAGE': {
    type: 'admin',
    icon: 'shield_person',
    module: 'Administración de Accesos',
    shortLabel: 'Gestor Accesos',
    capabilities: [
      'Administración completa de perfiles (crear usuarios, asignar roles).',
      'Configurar el alcance visual (Business Units, filtros geográficos).',
      'Atención: Nivel Crítico. Acceso a la modificación del entorno de seguridad.'
    ]
  }
};
