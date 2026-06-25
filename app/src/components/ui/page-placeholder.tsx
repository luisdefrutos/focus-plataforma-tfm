/**
 * Placeholder visual reutilizable para páginas pendientes de implementar.
 *
 * Client component por usar <TsIcon> (Web Component). El sub-entry
 * `@tuvsud/design-system/react/icon` está protegido con safeDefine —
 * seguro de evaluar durante SSR sin dynamic({ ssr: false }).
 */
'use client';

import { TsIcon } from '@tuvsud/design-system/react/icon';

type Props = {
  title: string;
  description: string;
  icon: string;
  nextStep: string;
};

export function PagePlaceholder({ title, description, icon, nextStep }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}
        >
          {title}
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}
        >
          {description}
        </p>
      </div>

      <div
        className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-24 text-center"
        style={{
          borderColor: 'var(--ts-semantic-color-border-base-default)',
          background: 'var(--ts-semantic-color-surface-default)',
        }}
      >
        <TsIcon
          name={icon}
          size={48}
          aria-hidden="true"
          style={{ '--icon-color': 'var(--ts-semantic-color-icon-secondary-default)' } as React.CSSProperties}
        />
        <p
          className="text-base font-semibold"
          style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}
        >
          Pendiente de implementación
        </p>
        <p
          className="max-w-md text-sm"
          style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}
        >
          {nextStep}
        </p>
      </div>
    </div>
  );
}
