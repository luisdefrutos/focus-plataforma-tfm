/**
 * Banner persistente de incompatibilidades legales del Buscador 360.
 *
 * Aparece cuando la selección de materiales activa pares de la matriz de conflictos
 * (Anexo 4 GG6): informa de cuántos clientes se han EXCLUIDO por incompatibilidad
 * total (X ⛔ Y) y de qué pares parciales marcan filas con warning. No es
 * descartable: mientras el filtro esté activo, el aviso permanece.
 */
'use client';

import type { CustomerSearchIncompatibility } from '@/lib/queries/customers';

/** Etiqueta corta de un material para el banner: código + descripción truncada. */
function matLabel(code: string, desc: string | null): string {
  if (!desc) return code;
  const short = desc.length > 60 ? `${desc.slice(0, 57)}…` : desc;
  return `${code} (${short})`;
}

export function IncompatibilityBanner({ data }: { data: CustomerSearchIncompatibility }) {
  const totals = data.pairs.filter(p => p.severity === 'TOTAL');
  const partials = data.pairs.filter(p => p.severity === 'PARCIAL');
  if (totals.length === 0 && partials.length === 0) return null;

  return (
    <div
      role="status"
      className="rounded-lg border px-4 py-3 text-sm"
      style={{
        background: 'var(--ts-semantic-color-background-warning-subtle-default)',
        borderColor: 'var(--ts-semantic-color-text-warning-default)',
        color: 'var(--ts-semantic-color-text-primary-default)',
      }}
    >
      <div className="flex items-start gap-2.5">
        <span aria-hidden className="mt-0.5 shrink-0 text-lg leading-none" style={{ color: 'var(--ts-semantic-color-text-warning-default)' }}>
          ⚖
        </span>
        <div className="min-w-0 space-y-1.5">
          <p className="font-semibold">
            Incompatibilidades legales entre servicios (matriz de conflictos OC)
          </p>
          {totals.length > 0 && (
            <p>
              <strong>{data.excludedCount}</strong> {data.excludedCount === 1 ? 'cliente excluido' : 'clientes excluidos'} del
              resultado por incompatibilidad <strong>total</strong> con el servicio seleccionado:
            </p>
          )}
          {totals.length > 0 && (
            <ul className="ml-1 space-y-0.5">
              {totals.map((p, i) => (
                <li key={`t${i}`} className="truncate" title={`${p.selected} es incompatible (TOTAL) con ${p.conflicting}`}>
                  <span className="font-mono text-xs font-semibold">{p.selected}</span>
                  {' '}⛔{' '}
                  <span title={p.conflictingDesc ?? undefined}>{matLabel(p.conflicting, p.conflictingDesc)}</span>
                </li>
              ))}
            </ul>
          )}
          {partials.length > 0 && (
            <p style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}>
              Los clientes marcados con la etiqueta{' '}
              <strong style={{ color: 'var(--ts-semantic-color-text-warning-default)' }}>⚠ Conflicto parcial</strong>
              {' '}facturan servicios con incompatibilidad <strong>parcial</strong> (requieren vigilancia):{' '}
              {partials.map(p => `${p.selected} ⚠ ${p.conflicting}`).join(' · ')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
