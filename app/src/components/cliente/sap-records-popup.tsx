/**
 * Chip "N registros SAP" de la cabecera de la ficha → al hacer click abre un
 * diálogo con los registros SAP unificados bajo la organización (Golden Record).
 * Sustituye a la antigua sección fija "Registros SAP unificados" de la página.
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TsDialog } from '@tuvsud/design-system/react/dialog';
import { Icon } from '@/components/ui/icon';

export type SapRecord = {
  customerId: number;
  sapCustomerCode: string | null;
  legalName: string;
};

export function SapRecordsChip({ records }: { records: SapRecord[] }) {
  const [open, setOpen] = useState(false);
  const n = records.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase transition-opacity hover:opacity-80"
        style={{
          background: 'var(--ts-semantic-color-background-primary-subtle-default)',
          color: 'var(--ts-semantic-color-text-link-default)',
        }}
        title="Ver los registros de cliente en SAP unificados bajo este CIF (Golden Record)"
      >
        <Icon name="hub" size={12} />
        {n} {n === 1 ? 'registro' : 'registros'} SAP
        <Icon name="expand_more" size={14} />
      </button>

      {/* Montado solo al abrir: evita el flash de contenido sin estilo (el WC ts-dialog
          se registra en cliente) y no carga el diálogo en el SSR de la ficha. */}
      {open && (
        <TsDialog
          open
          label={`Registros SAP unificados (${n})`}
          onTsAfterHide={() => setOpen(false)}
        >
          <p className="mb-3 text-sm" style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}>
            Registros de cliente en SAP que comparten el CIF de esta organización. Abre uno para ver
            su ficha individual.
          </p>
          <div className="flex flex-col gap-1.5">
            {records.map(r => (
              <Link
                key={r.customerId}
                href={`/clientes/${r.customerId}?sap=1`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:underline"
                style={{
                  borderColor: 'var(--ts-semantic-color-border-base-default)',
                  color: 'var(--ts-semantic-color-text-primary-default)',
                }}
              >
                <Icon name="qr_code_2" size={15} />
                <span className="font-mono text-xs" style={{ color: 'var(--ts-semantic-color-text-link-default)' }}>
                  {r.sapCustomerCode ?? `#${r.customerId}`}
                </span>
                <span className="min-w-0 flex-1 truncate" title={r.legalName}>
                  {r.legalName}
                </span>
                <Icon name="chevron_right" size={15} />
              </Link>
            ))}
          </div>
        </TsDialog>
      )}
    </>
  );
}
