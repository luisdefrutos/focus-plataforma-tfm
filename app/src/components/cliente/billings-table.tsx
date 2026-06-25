/**
 * Tabla de facturas del cliente, AGRUPADAS por número de factura.
 * Cada fila es una factura (puede englobar varias líneas/servicios); el importe
 * es la suma y se muestra la descripción de la factura (invoice_description) y la BU.
 * Server component (los datos vienen prefetched de la página).
 */

import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import { Pagination } from '@/components/buscador/pagination';

type Props = {
  rows: Array<{
    invoiceKey: string;
    invoiceNumber: string | null;
    invoiceDate: Date | null;
    totalAmount: number | null;
    lineCount: number;
    materialCount: number;
    description: string | null;
    materialCodes: string | null;
    buNames: string | null;
    sapCodes: string | null;
    profitCenters: string | null;
  }>;
  total: number;
  page: number;
  pageSize: number;
};

export function BillingsTable({ rows, total, page, pageSize }: Props) {
  return (
    <div className="space-y-3">
      <div
        className="overflow-hidden rounded-lg border"
        style={{
          background: 'var(--ts-semantic-color-surface-default)',
          borderColor: 'var(--ts-semantic-color-border-base-default)',
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead
              className="border-b"
              style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}
            >
              <tr>
                <Th>Fecha</Th>
                <Th>Nº factura</Th>
                <Th>Descripción</Th>
                <Th>BU / Sociedad</Th>
                <Th align="right">Importe</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr
                  key={r.invoiceKey}
                  className="border-b transition-colors hover:bg-[var(--ts-semantic-color-background-base-hover)]"
                  style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}
                >
                  <td 
                    className="whitespace-nowrap px-4 py-2.5 align-top text-sm tabular-nums"
                    style={{ color: 'var(--ts-semantic-color-text-link-default)' }}
                  >
                    {formatDate(r.invoiceDate)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 align-top text-sm">
                    <span style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}>
                      {r.invoiceNumber ?? 'Sin nº'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 align-top text-sm" style={{ minWidth: '220px', maxWidth: '360px' }}>
                    <p
                      className="truncate font-medium"
                      style={{ color: 'var(--ts-semantic-color-text-link-default)' }}
                      title={r.description || undefined}
                    >
                      {r.description || '—'}
                    </p>
                    <p
                      className="truncate text-xs"
                      style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}
                      title={r.materialCodes || undefined}
                    >
                      {r.materialCount > 1 ? `${formatNumber(r.materialCount)} servicios · ` : ''}
                      {r.materialCodes ?? ''}
                    </p>
                  </td>
                  <td className="px-4 py-2.5 align-top text-sm">
                    <p
                      className="truncate"
                      style={{ color: 'var(--ts-semantic-color-text-secondary-default)', maxWidth: '220px' }}
                      title={r.buNames || undefined}
                    >
                      {r.buNames ?? '—'}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}
                    >
                      {r.sapCodes}
                      {r.profitCenters && <> · PC {r.profitCenters}</>}
                    </p>
                  </td>
                  <td
                    className="whitespace-nowrap px-4 py-2.5 text-right align-top text-sm font-semibold tabular-nums"
                    style={{ color: 'var(--ts-semantic-color-text-link-default)' }}
                  >
                    {formatCurrency(r.totalAmount)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm"
                    style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}
                  >
                    No hay facturas para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} pageSize={pageSize} total={total} />
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider ${align === 'right' ? 'text-right' : 'text-left'}`}
      style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}
    >
      {children}
    </th>
  );
}
