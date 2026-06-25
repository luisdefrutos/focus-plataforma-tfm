/**
 * Filtros de la página Top clientes — sincronizados con URL searchParams.
 *
 * Sustituye al <form method="get"> que tenía la página server. Igual patrón
 * que filter-bar.tsx / segmentation-filters.tsx.
 */
'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useTransition } from 'react';
import { TsSelect } from '@tuvsud/design-system/react/select';
import { TsOption } from '@tuvsud/design-system/react/option';
import { TsButton } from '@tuvsud/design-system/react/button';

const PRESET_N = [10, 25, 50, 100];

type Props = {
  entities: Array<{ sapCode: string; legalName: string }>;
  divisions: Array<{ divisionCode: string; divisionName: string }>;
  years: number[];
};

const targetValue = (e: Event) => (e.target as HTMLInputElement).value;

export function TopFilters({ entities, divisions, years }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [topN, setTopN] = useState(params.get('top') ?? '50');
  const [entity, setEntity] = useState(params.get('entity') ?? '');
  const [division, setDivision] = useState(params.get('division') ?? '');
  const [year, setYear] = useState(params.get('year') ?? '');
  const [ic, setIc] = useState(params.get('ic') ?? '');

  // Re-sincroniza con la URL sin useEffect (ajuste de estado durante el render).
  const paramsKey = params.toString();
  const [prevParamsKey, setPrevParamsKey] = useState(paramsKey);
  if (paramsKey !== prevParamsKey) {
    setPrevParamsKey(paramsKey);
    setTopN(params.get('top') ?? '50');
    setEntity(params.get('entity') ?? '');
    setDivision(params.get('division') ?? '');
    setYear(params.get('year') ?? '');
    setIc(params.get('ic') ?? '');
  }

  function apply() {
    const next = new URLSearchParams();
    if (topN && topN !== '50') next.set('top', topN);
    if (entity) next.set('entity', entity);
    if (division) next.set('division', division);
    if (year) next.set('year', year);
    if (ic) next.set('ic', ic);
    startTransition(() => router.push(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false }));
  }

  function clear() {
    setTopN('50'); setEntity(''); setDivision(''); setYear(''); setIc('');
    startTransition(() => router.push(pathname, { scroll: false }));
  }

  const hasAny = !!(entity || division || year || ic) || topN !== '50';

  return (
    <form
      onSubmit={e => { e.preventDefault(); apply(); }}
      className="grid grid-cols-1 gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-[100px_1fr_1fr_120px_1fr_auto]"
      style={{
        background: 'var(--ts-semantic-color-surface-default)',
        borderColor: 'var(--ts-semantic-color-border-base-default)',
      }}
    >
      <TsSelect label="Top N" value={topN}
        onTsChange={(e: Event) => setTopN(targetValue(e))}>
        {PRESET_N.map(n => <TsOption key={n} value={String(n)}>{n}</TsOption>)}
      </TsSelect>

      <TsSelect label="Sociedad" value={entity} placeholder="Todas" clearable
        onTsChange={(e: Event) => setEntity(targetValue(e))}>
        {entities.map(en => (
          <TsOption key={en.sapCode} value={en.sapCode}>
            {en.sapCode} — {en.legalName.length > 28 ? en.legalName.slice(0, 26) + '…' : en.legalName}
          </TsOption>
        ))}
      </TsSelect>

      <TsSelect label="División" value={division} placeholder="Todas" clearable
        onTsChange={(e: Event) => setDivision(targetValue(e))}>
        {divisions.map(d => (
          <TsOption key={d.divisionCode} value={d.divisionCode}>
            {d.divisionCode} — {d.divisionName}
          </TsOption>
        ))}
      </TsSelect>

      <TsSelect label="Año" value={year} placeholder="Todos" clearable
        onTsChange={(e: Event) => setYear(targetValue(e))}>
        {years.map(y => <TsOption key={y} value={String(y)}>{y}</TsOption>)}
      </TsSelect>

      <TsSelect label="Intercompany" value={ic} placeholder="Todos" clearable
        onTsChange={(e: Event) => setIc(targetValue(e))}>
        <TsOption value="0">Excluir intercompany</TsOption>
      </TsSelect>

      <div className="flex items-end gap-2">
        {hasAny && <TsButton variant="text" onClick={clear}>Limpiar</TsButton>}
        <TsButton variant="primary" type="submit" disabled={pending} loading={pending}>
          Aplicar
        </TsButton>
      </div>
    </form>
  );
}
