'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export function LoadingOverlay({ isPending }: { isPending: boolean }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Guard de montaje para SSR (createPortal solo en cliente): efecto legítimo de
    // sincronización con el entorno, no derivable durante el render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!isPending || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/5 transition-opacity">
      <div className="flex flex-col items-center gap-4 rounded-xl bg-white p-6 shadow-2xl ring-1 ring-black/5">
        <div 
          className="h-8 w-8 animate-spin rounded-full border-4" 
          style={{ 
            borderColor: 'var(--ts-semantic-color-border-base-subtle)', 
            borderTopColor: 'var(--ts-semantic-color-interactive-primary-default)' 
          }}
        ></div>
        <p className="text-sm font-semibold" style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}>
          Cargando datos...
        </p>
      </div>
    </div>,
    document.body
  );
}
