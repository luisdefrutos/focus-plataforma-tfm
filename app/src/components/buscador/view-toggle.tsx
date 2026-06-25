/**
 * Toggle de vista del Buscador 360 — alterna entre la tabla de clientes y el
 * "modo whitespot" (vista agregada por sociedad/BU de la cartera filtrada).
 *
 * El modo vive en la URL (?view=whitespot) para que sea linkable y se conserve al
 * recargar; ausente o "table" = tabla. Client component porque usa Ts* (Web
 * Components) y navega con router.push (igual que el resto del buscador).
 *
 * Detalle de eventos: TsRadioGroup expone `onTsChange` (no `onSl*`); el value del
 * grupo refleja el botón seleccionado (mismo patrón que el toggle Incluir/Excluir).
 */
'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { TsRadioGroup } from '@tuvsud/design-system/react/radio-group';
import { TsRadioButton } from '@tuvsud/design-system/react/radio-button';
import { TsIcon } from '@tuvsud/design-system/react/icon';
import { LoadingOverlay } from '@/components/ui/loading-overlay';

const targetValue = (e: Event) => (e.target as HTMLInputElement).value;

export function ViewToggle({ current }: { current: 'table' | 'whitespot' }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setView(v: string) {
    if (v === current) return;
    const sp = new URLSearchParams(params.toString());
    if (v === 'whitespot') sp.set('view', 'whitespot');
    else sp.delete('view');
    // La paginación es propia de la tabla; al cambiar de vista volvemos a página 1.
    sp.delete('page');
    startTransition(() => router.push(`${pathname}?${sp.toString()}`, { scroll: false }));
  }

  return (
    <>
      <LoadingOverlay isPending={pending} />
      <TsRadioGroup value={current} onTsChange={(e: Event) => setView(targetValue(e))}>
        <TsRadioButton value="table">
          <TsIcon slot="prefix" name="table_rows" />
          Tabla
        </TsRadioButton>
        <TsRadioButton value="whitespot">
          <TsIcon slot="prefix" name="dashboard" />
          Whitespots
        </TsRadioButton>
      </TsRadioGroup>
    </>
  );
}
