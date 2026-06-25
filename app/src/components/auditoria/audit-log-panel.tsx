/**
 * Panel del registro de actividad (/auditoria) — solo administradores.
 *
 * Filtros server-side vía URL (?username=&category=&event=&outcome=&from=&to=&q=&page=).
 * Usamos controles nativos para los filtros (fiables, sin los matices de eventos de los
 * Web Components) y Ts* para los botones de acción. La tabla muestra una fila por evento
 * con detalle expandible (metadatos + user agent).
 */
'use client';

import { useState, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { TsButton } from '@tuvsud/design-system/react/button';
import { TsIcon } from '@tuvsud/design-system/react/icon';
import { Icon } from '@/components/ui/icon';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { formatNumber } from '@/lib/utils';
import {
  AUDIT_EVENTS, AUDIT_CATEGORY_LABELS, getEventLabel, getEventMeta, getExportEndpoint, type AuditCategory,
} from '@/lib/audit-events';
import type { AuditEventRow, AuditSearchResult } from '@/lib/queries/audit';

type Filters = {
  username: string;
  category: string;
  eventType: string;
  outcome: string;
  dateFrom: string;
  dateTo: string;
  q: string;
};

type Props = {
  result: AuditSearchResult;
  users: { username: string; userFullName: string | null }[];
  filters: Filters;
};

const DT = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'medium' });
function fmtDateTime(d: Date | string): string {
  return DT.format(typeof d === 'string' ? new Date(d) : d);
}

const CATEGORY_CHIP: Record<AuditCategory, string> = {
  AUTH: 'bg-blue-100 text-blue-800',
  EXPORT: 'bg-violet-100 text-violet-800',
  IAM: 'bg-amber-100 text-amber-800',
};

const ctrlStyle: React.CSSProperties = {
  borderColor: 'var(--ts-semantic-color-border-base-default)',
  background: 'var(--ts-semantic-color-surface-default)',
  color: 'var(--ts-semantic-color-text-primary-default)',
};
const ctrlClass = 'w-full px-3 py-2 text-sm border rounded-md';

export function AuditLogPanel({ result, users, filters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // `draft` se inicializa desde los filtros de la URL. El padre remonta el panel
  // (vía `key`) cuando cambian los filtros aplicados, así que no hace falta efecto
  // para resincronizar tras navegar/limpiar.
  const [draft, setDraft] = useState<Filters>(filters);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const set = (k: keyof Filters, v: string) =>
    setDraft(prev => ({ ...prev, [k]: v, ...(k === 'category' ? { eventType: '' } : {}) }));

  function buildParams(extra?: Record<string, string>): URLSearchParams {
    const next = new URLSearchParams();
    const values: Record<string, string> = {
      username: draft.username,
      category: draft.category,
      event: draft.eventType,
      outcome: draft.outcome,
      from: draft.dateFrom,
      to: draft.dateTo,
      q: draft.q.trim(),
      ...extra,
    };
    for (const [k, v] of Object.entries(values)) {
      if (v) next.set(k, v);
    }
    return next;
  }

  function apply() {
    const next = buildParams({ page: '1' });
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  function clear() {
    startTransition(() => router.push(pathname, { scroll: false }));
  }

  function goTo(page: number) {
    const next = new URLSearchParams(params.toString());
    next.set('page', String(page));
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  function exportCsv() {
    // Exporta con los filtros YA aplicados (los de la URL), sin la paginación.
    const next = new URLSearchParams(params.toString());
    next.delete('page');
    window.location.assign(`/api/auditoria/export?${next.toString()}`);
  }

  function toggle(id: number) {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  const { rows, total, page, pageSize } = result;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  // Tipos de evento disponibles en el desplegable (filtrados por la categoría elegida).
  const eventOptions = Object.entries(AUDIT_EVENTS)
    .filter(([, meta]) => !draft.category || meta.category === draft.category);

  return (
    <div className="space-y-4 relative">
      <LoadingOverlay isPending={isPending} />

      {/* Barra de filtros */}
      <div
        className="rounded-lg border p-4"
        style={{ background: 'var(--ts-semantic-color-surface-default)', borderColor: 'var(--ts-semantic-color-border-base-default)' }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium opacity-70">Usuario</label>
            <select className={ctrlClass} style={ctrlStyle} value={draft.username} onChange={e => set('username', e.target.value)}>
              <option value="">Todos</option>
              {users.map(u => (
                <option key={u.username} value={u.username}>
                  {u.userFullName ? `${u.userFullName} (${u.username})` : u.username}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium opacity-70">Categoría</label>
            <select className={ctrlClass} style={ctrlStyle} value={draft.category} onChange={e => set('category', e.target.value)}>
              <option value="">Todas</option>
              {(Object.keys(AUDIT_CATEGORY_LABELS) as AuditCategory[]).map(c => (
                <option key={c} value={c}>{AUDIT_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium opacity-70">Tipo de evento</label>
            <select className={ctrlClass} style={ctrlStyle} value={draft.eventType} onChange={e => set('eventType', e.target.value)}>
              <option value="">Todos</option>
              {eventOptions.map(([code, meta]) => (
                <option key={code} value={code}>{meta.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium opacity-70">Resultado</label>
            <select className={ctrlClass} style={ctrlStyle} value={draft.outcome} onChange={e => set('outcome', e.target.value)}>
              <option value="">Todos</option>
              <option value="SUCCESS">Éxito</option>
              <option value="FAILURE">Fallo</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium opacity-70">Desde</label>
            <input type="date" className={ctrlClass} style={ctrlStyle} value={draft.dateFrom} onChange={e => set('dateFrom', e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium opacity-70">Hasta</label>
            <input type="date" className={ctrlClass} style={ctrlStyle} value={draft.dateTo} onChange={e => set('dateTo', e.target.value)} />
          </div>

          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium opacity-70">Buscar (usuario, descripción, IP)</label>
            <input
              type="text" className={ctrlClass} style={ctrlStyle} value={draft.q}
              onChange={e => set('q', e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') apply(); }}
              placeholder="Texto libre…"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <TsButton variant="primary" onClick={apply}>Filtrar</TsButton>
          <TsButton variant="secondary" onClick={clear}>Limpiar</TsButton>
          <div className="flex-1" />
          <TsButton variant="secondary" onClick={exportCsv} disabled={total === 0}>
            <TsIcon slot="prefix" name="download" />
            Exportar CSV
          </TsButton>
        </div>
      </div>

      {/* Tabla de eventos */}
      <div
        className="overflow-hidden rounded-lg border"
        style={{ background: 'var(--ts-semantic-color-surface-default)', borderColor: 'var(--ts-semantic-color-border-base-default)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide opacity-60" style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}>
                <th className="px-4 py-3 font-semibold">Fecha y hora</th>
                <th className="px-4 py-3 font-semibold">Usuario</th>
                <th className="px-4 py-3 font-semibold">Evento</th>
                <th className="px-4 py-3 font-semibold">Resultado</th>
                <th className="px-4 py-3 font-semibold">IP</th>
                <th className="px-4 py-3 font-semibold text-right">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center opacity-60">
                    No hay eventos que coincidan con los filtros.
                  </td>
                </tr>
              )}
              {rows.map(row => (
                <AuditRow key={row.auditId} row={row} isOpen={expanded.has(row.auditId)} onToggle={() => toggle(row.auditId)} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t px-4 py-3 text-sm"
          style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}
        >
          <p style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}>
            Mostrando <strong>{formatNumber(from)}</strong>–<strong>{formatNumber(to)}</strong> de{' '}
            <strong>{formatNumber(total)}</strong> eventos
          </p>
          <div className="flex items-center gap-2">
            <TsButton size="small" variant="secondary" disabled={page <= 1} onClick={() => goTo(page - 1)}>Anterior</TsButton>
            <span className="mx-1 tabular-nums" style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}>
              Página <strong>{page}</strong> de <strong>{formatNumber(totalPages)}</strong>
            </span>
            <TsButton size="small" variant="secondary" disabled={page >= totalPages} onClick={() => goTo(page + 1)}>Siguiente</TsButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuditRow({ row, isOpen, onToggle }: { row: AuditEventRow; isOpen: boolean; onToggle: () => void }) {
  const meta = getEventMeta(row.eventType);
  const category = (meta?.category ?? row.category) as AuditCategory;
  const isFail = row.outcome === 'FAILURE';

  // Reexportación: para eventos de exportación con filtros guardados, reconstruimos
  // la URL del endpoint correspondiente y la descargamos. La reexportación corre
  // como el admin actual y sobre los datos ACTUALES (no es una copia histórica del CSV).
  const md = (row.metadata && typeof row.metadata === 'object' ? row.metadata : null) as
    { filters?: Record<string, unknown>; reexportOf?: number } | null;
  const exportEndpoint = getExportEndpoint(row.eventType);
  const reexportFilters = md?.filters && typeof md.filters === 'object' ? md.filters : null;
  const canReexport = !isFail && !!exportEndpoint && !!reexportFilters;
  const hasDetail = row.metadata != null || !!row.userAgent || !!row.targetId;

  function reexport() {
    if (!exportEndpoint || !reexportFilters) return;
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(reexportFilters)) {
      if (v != null && v !== '') qs.set(k, String(v));
    }
    qs.set('reexportOf', String(row.auditId));
    window.location.assign(`${exportEndpoint}?${qs.toString()}`);
  }

  return (
    <>
      <tr className="border-b align-top" style={{ borderColor: 'var(--ts-semantic-color-border-base-subtle)' }}>
        <td className="px-4 py-3 whitespace-nowrap tabular-nums">{fmtDateTime(row.createdAt)}</td>
        <td className="px-4 py-3">
          <div className="font-medium" style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}>
            {row.userFullName || '—'}
          </div>
          <div className="text-xs opacity-60">@{row.username}</div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${CATEGORY_CHIP[category] ?? 'bg-gray-100 text-gray-700'}`}>
              {AUDIT_CATEGORY_LABELS[category] ?? row.category}
            </span>
            <span>{getEventLabel(row.eventType)}</span>
          </div>
          <div className="mt-0.5 text-xs opacity-70">{row.description}</div>
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${isFail ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
            {isFail ? 'Fallo' : 'Éxito'}
          </span>
        </td>
        <td className="px-4 py-3 whitespace-nowrap tabular-nums opacity-80">{row.ipAddress || '—'}</td>
        <td className="px-4 py-3 text-right">
          {hasDetail ? (
            <button onClick={onToggle} className="inline-flex items-center gap-1 text-xs font-medium opacity-80 hover:opacity-100" aria-expanded={isOpen}>
              {isOpen ? 'Ocultar' : 'Ver'}
              <Icon name={isOpen ? 'expand_less' : 'expand_more'} />
            </button>
          ) : (
            <span className="opacity-30">—</span>
          )}
        </td>
      </tr>
      {isOpen && hasDetail && (
        <tr style={{ background: 'var(--ts-semantic-color-background-secondary-default)' }}>
          <td colSpan={6} className="px-4 py-3">
            {canReexport && (
              <div className="mb-3 flex flex-col gap-1">
                <div>
                  <TsButton size="small" variant="primary" onClick={reexport}>
                    <TsIcon slot="prefix" name="download" />
                    Reexportar CSV
                  </TsButton>
                </div>
                <p className="text-[11px] opacity-60">
                  Vuelve a generar el CSV con los mismos filtros que usó el usuario, sobre los datos actuales.
                  La reexportación queda registrada a tu nombre.
                </p>
              </div>
            )}
            <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              {md?.reexportOf != null && (
                <div>
                  <dt className="font-semibold opacity-60">Reexportación de</dt>
                  <dd className="mt-0.5">evento #{md.reexportOf}</dd>
                </div>
              )}
              {row.targetId && (
                <div>
                  <dt className="font-semibold opacity-60">Destino</dt>
                  <dd className="mt-0.5">{row.targetType ? `${row.targetType}: ` : ''}{row.targetId}</dd>
                </div>
              )}
              {row.userAgent && (
                <div>
                  <dt className="font-semibold opacity-60">User agent</dt>
                  <dd className="mt-0.5 break-words">{row.userAgent}</dd>
                </div>
              )}
              {row.metadata != null && (
                <div className="sm:col-span-2">
                  <dt className="font-semibold opacity-60">Metadatos</dt>
                  <dd>
                    <pre className="mt-1 overflow-x-auto rounded-md p-3 text-[11px] leading-relaxed"
                      style={{ background: 'var(--ts-semantic-color-surface-default)', border: '1px solid var(--ts-semantic-color-border-base-subtle)' }}>
                      {JSON.stringify(row.metadata, null, 2)}
                    </pre>
                  </dd>
                </div>
              )}
            </dl>
          </td>
        </tr>
      )}
    </>
  );
}
