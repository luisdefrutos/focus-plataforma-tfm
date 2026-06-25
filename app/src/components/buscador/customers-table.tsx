/**
 * Tabla del Buscador 360 — TanStack Table v8 + Next.js URL navigation.
 *
 * El ordenamiento y paginación viven en la URL (?sort=...&dir=...&page=...).
 * Para 171k filas la paginación es server-side; cada cambio de URL provoca un
 * refetch en el RSC padre y reload de la tabla.
 */
'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  flexRender, getCoreRowModel, useReactTable,
  type ColumnDef, type SortingState,
} from '@tanstack/react-table';
import Link from 'next/link';
import { TsIcon } from '@tuvsud/design-system/react/icon';
import type { CustomerSearchRow, SortField, SortDir } from '@/lib/queries/customers';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';

const columns: ColumnDef<CustomerSearchRow>[] = [
  {
    accessorKey: 'legalName',
    header: 'Cliente',
    enableSorting: true,
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link
          href={`/clientes/${row.original.customerId}`}
          className="block truncate text-sm font-medium hover:underline"
          style={{ color: 'var(--ts-semantic-color-text-link-default)' }}
          title={row.original.legalName}
        >
          {row.original.legalName}
        </Link>
        <p
          className="truncate text-xs"
          style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}
        >
          {row.original.taxId}
          {row.original.sapCount > 1
            ? <> · <strong>{row.original.sapCount} registros SAP</strong></>
            : row.original.sapCustomerCode && <> · SAP {row.original.sapCustomerCode}</>}
          <span
            className="ml-2 inline-block rounded px-1 py-0.5 text-[10px] font-mono"
            style={{
              background: 'var(--ts-semantic-color-background-neutral-subtle-default)',
              color: 'var(--ts-semantic-color-text-tertiary-default)',
            }}
            title="Tipo de entidad (CIF/NIF)"
          >
            {row.original.entityType}
          </span>
          {row.original.isIntercompany && (
            <span
              className="ml-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase"
              style={{
                background: 'var(--ts-semantic-color-background-primary-subtle-default)',
                color: 'var(--ts-semantic-color-text-link-default)',
              }}
              title="Cliente del propio grupo TÜV LFD"
            >
              IC
            </span>
          )}
          {row.original.isBlocked && (
            <span
              className="ml-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase"
              style={{
                background: 'var(--ts-semantic-color-background-danger-subtle-default)',
                color: 'var(--ts-semantic-color-text-danger-default)',
              }}
              title="Cliente bloqueado/duplicado en SAP"
            >
              BLOCKED
            </span>
          )}
          {row.original.hasPartialConflict && (
            <span
              className="ml-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase"
              style={{
                background: 'var(--ts-semantic-color-background-warning-subtle-default)',
                color: 'var(--ts-semantic-color-text-warning-default)',
              }}
              title="Incompatibilidad PARCIAL: este cliente factura servicios con conflicto parcial (requiere vigilancia) respecto al servicio filtrado — ver banner superior"
            >
              ⚠ Conflicto parcial
            </span>
          )}
        </p>
      </div>
    ),
  },
  {
    id: 'yearsActive',
    header: () => (
      <span title="Número de años distintos con facturación (recurrencia del cliente)">
        Recurrencia
      </span>
    ),
    enableSorting: false,
    cell: ({ row }) => (
      <p className="text-center text-sm tabular-nums">
        {row.original.yearsActive > 0 ? row.original.yearsActive : '—'}
      </p>
    ),
  },
  {
    accessorKey: 'invoiceCount',
    header: 'Nº de facturas',
    enableSorting: true,
    cell: ({ row }) => (
      <p className="text-center text-sm tabular-nums">
        {formatNumber(row.original.invoiceCount)}
      </p>
    ),
  },
  {
    id: 'buCount',
    header: () => (
      <span title="Número de unidades de negocio (BU) distintas con las que trabaja el cliente">
        Unidades de negocio
      </span>
    ),
    enableSorting: false,
    cell: ({ row }) => (
      <p className="text-center text-sm tabular-nums">
        {row.original.buCount > 0 ? row.original.buCount : '—'}
      </p>
    ),
  },
  {
    accessorKey: 'totalAmount',
    header: 'Facturado',
    enableSorting: true,
    cell: ({ row }) => (
      <p
        className="text-center text-sm font-semibold tabular-nums"
        style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}
      >
        {formatCurrency(row.original.totalAmount, { compact: true })}
      </p>
    ),
  },
  {
    accessorKey: 'lastInvoiceDate',
    header: 'Última factura',
    enableSorting: true,
    cell: ({ row }) => (
      <p className="text-center text-sm tabular-nums">
        {formatDate(row.original.lastInvoiceDate)}
      </p>
    ),
  },
];

type Props = {
  data: CustomerSearchRow[];
  /** Sort actual, leído del URL */
  currentSort: { field: SortField; dir: SortDir };
};

export function CustomersTable({ data, currentSort }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  /** Aplica sort a URL */
  function applySort(field: SortField) {
    const sp = new URLSearchParams(params.toString());
    let dir: SortDir = 'desc';
    if (currentSort.field === field) {
      dir = currentSort.dir === 'desc' ? 'asc' : 'desc';
    } else if (field === 'legalName') {
      dir = 'asc';
    }
    sp.set('sort', field);
    sp.set('dir', dir);
    sp.set('page', '1');
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  // Mapear estado actual a SortingState de TanStack (solo UI; el sort real es server)
  const sortingState: SortingState = [{
    id: currentSort.field,
    desc: currentSort.dir === 'desc',
  }];

  const table = useReactTable({
    data,
    columns,
    state: { sorting: sortingState },
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
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
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => {
                  const sortable = h.column.getCanSort();
                  const isCurrent = currentSort.field === (h.column.id as SortField);
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider ${
                        h.column.id === 'legalName' ? 'text-left' : 'text-center'
                      }`}
                      style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() => applySort(h.column.id as SortField)}
                          className={`inline-flex items-center gap-1 hover:text-[var(--ts-semantic-color-text-primary-default)] ${
                            h.column.id !== 'legalName' ? 'justify-center w-full' : ''
                          }`}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {isCurrent && (
                            <TsIcon
                              name={currentSort.dir === 'desc' ? 'arrow_downward' : 'arrow_upward'}
                              size={14}
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(r => (
              <tr
                key={r.id}
                className="border-b transition-colors hover:bg-[var(--ts-semantic-color-background-base-hover)]"
                style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}
              >
                {r.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-4 py-2.5 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-sm"
                  style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}
                >
                  No hay clientes que coincidan con los filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}