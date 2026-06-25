/**
 * KPI Card — layout de métrica con icono coloreado por tono.
 *
 * Decisión de diseño: NO usamos <TsCard> de Algorithm aquí. TsCard está
 * pensado para tarjetas de contenido con slots image/header/body/footer y un
 * divider; el KPI es un layout horizontal compacto (icon-en-caja-coloreada
 * + label + valor + hint). Mantenemos un <div> con tokens del DS, y solo
 * delegamos el icono al <TsIcon>.
 *
 * Es client component porque TsIcon es un Web Component (Web Components solo
 * existen en el navegador). El módulo se importa desde un sub-entry
 * (`@tuvsud/design-system/react/icon`) protegido con safeDefine, así que es
 * seguro evaluarlo durante SSR — no hace falta dynamic({ ssr: false }).
 */
'use client';

import { TsIcon } from '@tuvsud/design-system/react/icon';
import { cn } from '@/lib/utils';

type Props = {
  label: string;
  value: string;
  /** Material Symbol name */
  icon?: string;
  hint?: string;
  /** Mismatch entre cifra "buena" y "mala" — colorea el icono */
  tone?: 'neutral' | 'primary' | 'success' | 'danger';
};

const TONE_COLOR: Record<NonNullable<Props['tone']>, string> = {
  neutral: 'var(--ts-semantic-color-icon-secondary-default)',
  primary: 'var(--ts-semantic-color-icon-primary-default)',
  success: 'var(--ts-semantic-color-text-success-default)',
  danger:  'var(--ts-semantic-color-text-danger-default)',
};

const TONE_BG: Record<NonNullable<Props['tone']>, string> = {
  neutral: 'var(--ts-semantic-color-background-neutral-subtle-default)',
  primary: 'var(--ts-semantic-color-background-primary-subtle-default)',
  success: 'var(--ts-semantic-color-background-success-subtle-default)',
  danger:  'var(--ts-semantic-color-background-danger-subtle-default)',
};

export function KpiCard({ label, value, icon, hint, tone = 'primary' }: Props) {
  return (
    <div
      
      className={cn('flex items-start gap-4 rounded-lg border bg-card text-card-foreground p-5 transition-shadow hover:shadow-sm')}
    >
      {icon && (
        <div
          className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-md", 
      tone === 'success' && 'bg-green-100 text-green-700',
      tone === 'danger' && 'bg-red-100 text-red-700',
      tone === 'primary' && 'bg-blue-100 text-blue-700',
      tone === 'neutral' && 'bg-gray-100 text-gray-700'
    )}
          
        >
          <TsIcon
            name={icon}
            size={22}
            aria-hidden="true"
            // Forzamos el color via la CSS var del propio TsIcon — el default
            // es text-base-default (oscuro), que no contrasta bien con todos
            // los fondos sutiles del tono.
            className="currentColor"
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p
          
          className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
        >
          {label}
        </p>
        <p
          
          className="mt-1 truncate text-2xl font-bold leading-tight"
        >
          {value}
        </p>
        {hint && (
          <p
            
            className="mt-1 text-xs text-muted-foreground"
          >
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
