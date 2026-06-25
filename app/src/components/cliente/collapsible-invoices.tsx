/**
 * Colapso de la tabla de facturas de la ficha: oculta por defecto, se despliega
 * al pulsar el botón "Todas las facturas (N)". Se AUTOABRE cuando el usuario
 * filtra un año en el timeline o pagina la tabla (defaultOpen), para que esas
 * navegaciones —que recargan la página— no vuelvan a plegarla.
 */
'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/icon';

export function CollapsibleInvoices({
  label,
  defaultOpen,
  children,
}: {
  label: string;
  /** true cuando hay filtro de año o paginación activa en la URL. */
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  // Si una navegación (año del timeline, paginación) pide la tabla abierta, abrirla.
  // Ajuste de estado durante el render (sin useEffect) al cambiar defaultOpen.
  const [prevDefaultOpen, setPrevDefaultOpen] = useState(defaultOpen);
  if (defaultOpen !== prevDefaultOpen) {
    setPrevDefaultOpen(defaultOpen);
    if (defaultOpen) setOpen(true);
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="mb-3 inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold transition-colors hover:underline"
        style={{ color: 'var(--ts-semantic-color-text-link-default)' }}
      >
        <Icon name={open ? 'expand_less' : 'expand_more'} size={18} />
        {label}
      </button>
      {open && children}
    </div>
  );
}
