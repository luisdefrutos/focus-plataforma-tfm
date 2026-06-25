/**
 * Tabla unificada de contactos de la ficha (CRM + gestor + titular, ya deduplicados
 * por getUnifiedContacts). Muestra 5 filas y un botón "Mostrar más" para expandir.
 */
'use client';

import { useState } from 'react';
import type { UnifiedContact, ContactSource } from '@/lib/queries/customer-detail';
import { Icon } from '@/components/ui/icon';

const VISIBLE_ROWS = 5;

const SOURCE_STYLE: Record<ContactSource, { label: string; bg: string; fg: string }> = {
  CRM: {
    label: 'CRM',
    bg: 'var(--ts-semantic-color-background-primary-subtle-default)',
    fg: 'var(--ts-semantic-color-text-link-default)',
  },
  GESTOR: {
    label: 'Gestor',
    bg: 'var(--ts-semantic-color-background-warning-subtle-default)',
    fg: 'var(--ts-semantic-color-text-warning-default)',
  },
  TITULAR: {
    label: 'Titular',
    bg: 'var(--ts-semantic-color-background-success-subtle-default)',
    fg: 'var(--ts-semantic-color-text-success-default)',
  },
};

export function ContactsTable({ contacts }: { contacts: UnifiedContact[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? contacts : contacts.slice(0, VISIBLE_ROWS);
  const hidden = contacts.length - VISIBLE_ROWS;

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
          <thead className="border-b" style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}>
            <tr>
              <Th>Persona</Th>
              <Th>Origen</Th>
              <Th>Cargo</Th>
              <Th>Email</Th>
              <Th>Teléfonos</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map(c => (
              <tr
                key={c.key}
                className="border-b"
                style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}
              >
                <td className="px-4 py-2.5 align-top">
                  <p
                    className="font-medium"
                    style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}
                    title={c.mergedCount > 1 ? `${c.mergedCount} registros unificados bajo esta persona` : undefined}
                  >
                    {c.title ? `${c.title} ` : ''}{c.fullName}
                  </p>
                  {c.entitySapCode && (
                    <p className="text-xs" style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}>
                      {c.entitySapCode}
                    </p>
                  )}
                </td>
                <td className="px-4 py-2.5 align-top">
                  <div className="flex flex-wrap gap-1">
                    {c.sources.map(s => (
                      <span
                        key={s}
                        className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                        style={{ background: SOURCE_STYLE[s].bg, color: SOURCE_STYLE[s].fg }}
                        title={s === 'CRM' ? 'Contacto comercial (CRM)' : s === 'GESTOR' ? 'Contacto del gestor (extractos de inspecciones)' : 'Contacto del titular (extractos de inspecciones)'}
                      >
                        {SOURCE_STYLE[s].label}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2.5 align-top text-sm" style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}>
                  {c.position ?? '—'}
                </td>
                <td className="px-4 py-2.5 align-top text-sm">
                  {c.email ? (
                    <span className="flex items-center gap-1.5">
                      <a
                        href={`mailto:${c.email}`}
                        className="truncate hover:underline"
                        style={{ color: 'var(--ts-semantic-color-text-link-default)' }}
                      >
                        {c.email}
                      </a>
                      {c.emailVerified && (
                        <Icon name="verified" size={14} color="var(--ts-semantic-color-text-success-default)" title="Email validado (dominio B2B)" />
                      )}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-2.5 align-top text-sm tabular-nums" style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}>
                  <div className="flex flex-col">
                    {c.phone && <span>{c.phone}</span>}
                    {c.mobile && <span className="text-xs">📱 {c.mobile}</span>}
                    {!c.phone && !c.mobile && '—'}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="flex w-full items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors hover:underline"
          style={{ color: 'var(--ts-semantic-color-text-link-default)' }}
        >
          <Icon name={expanded ? 'expand_less' : 'expand_more'} size={18} />
          {expanded ? 'Mostrar menos' : `Mostrar más (${hidden} contactos)`}
        </button>
      )}
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'center' | 'right' }) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-${align}`}
      style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}
    >
      {children}
    </th>
  );
}
