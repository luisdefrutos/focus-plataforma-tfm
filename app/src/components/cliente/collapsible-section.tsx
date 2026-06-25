/**
 * Sección de la ficha con cabecera plegable: misma apariencia que las secciones
 * fijas de la página (icono + título + contador) pero el header es un botón que
 * muestra/oculta el contenido. Abierta por defecto.
 */
'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/icon';

export function CollapsibleSection({
  title,
  icon,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="mb-3 flex cursor-pointer items-baseline gap-2"
      >
        <Icon name={icon} size={20} color="var(--ts-semantic-color-icon-primary-default)" />
        <h2
          className="text-lg font-semibold"
          style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}
        >
          {title}
          {count != null && (
            <span
              className="ml-2 text-sm font-normal"
              style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}
            >
              ({count})
            </span>
          )}
        </h2>
        <Icon
          name={open ? 'expand_less' : 'expand_more'}
          size={18}
          color="var(--ts-semantic-color-icon-primary-default)"
        />
      </button>
      {open && children}
    </section>
  );
}
