/**
 * Paginación server-side — navega cambiando ?page= en URL.
 *
 * Client component porque usa TsIconButton (Web Component). Sub-entries
 * individuales del DS son safe en SSR (safeDefine), por lo que no requiere
 * dynamic({ ssr: false }).
 *
 * Nota sobre TsIconButton: sus props `name` y `label` mapean al icono y al
 * aria-label respectivamente. El name resuelve contra la library "material"
 * (configurada en algorithm-init.tsx → outlined del CDN).
 */
'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { TsIconButton } from '@tuvsud/design-system/react/icon-button';
import { formatNumber, formatCurrency } from '@/lib/utils';
import { useTransition } from 'react';
import { LoadingOverlay } from '@/components/ui/loading-overlay';

type Props = {
  page: number;
  pageSize: number;
  total: number;
  /** Suma de facturación de los clientes filtrados (todo el conjunto). */
  sumAmount?: number;
};

export function Pagination({ page, pageSize, total, sumAmount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  function goTo(p: number) {
    const sp = new URLSearchParams(params.toString());
    sp.set('page', String(p));
    startTransition(() => {
      router.push(`${pathname}?${sp.toString()}`, { scroll: false });
    });
  }

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <>
      <LoadingOverlay isPending={isPending} />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1 py-2 text-sm">
        <p style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}>
        Mostrando <strong>{formatNumber(from)}</strong>–<strong>{formatNumber(to)}</strong> de{' '}
        <strong>{formatNumber(total)}</strong> clientes
        {sumAmount != null && (
          <>
            {' · Facturación total: '}
            <strong style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}>
              {formatCurrency(sumAmount)}
            </strong>
          </>
        )}
      </p>
      <div className="flex items-center gap-1">
        <TsIconButton name="first_page" label="Primera" disabled={!canPrev} onClick={() => goTo(1)} />
        <TsIconButton name="chevron_left" label="Anterior" disabled={!canPrev} onClick={() => goTo(page - 1)} />
        <span
          className="mx-2 text-sm tabular-nums"
          style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}
        >
          Página <strong>{page}</strong> de <strong>{formatNumber(totalPages)}</strong>
        </span>
        <TsIconButton name="chevron_right" label="Siguiente" disabled={!canNext} onClick={() => goTo(page + 1)} />
        <TsIconButton name="last_page" label="Última" disabled={!canNext} onClick={() => goTo(totalPages)} />
      </div>
    </div>
    </>
  );
}
