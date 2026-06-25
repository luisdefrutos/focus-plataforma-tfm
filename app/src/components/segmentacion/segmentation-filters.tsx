/**
 * Filtros de la página de segmentación — sincronizados con URL searchParams.
 *
 * Sociedad / División / Año son multi-select (TsSelect `multiple`): viajan en la
 * URL como lista separada por comas y la query las resuelve con `IN (...)`.
 * Mismo patrón que filter-bar.tsx del Buscador 360. Intercompany se queda como
 * selector simple porque es un modo excluyente (todos / excluir), no acumulable.
 */
'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useTransition } from 'react';
import { TsSelect } from '@tuvsud/design-system/react/select';
import { TsOption } from '@tuvsud/design-system/react/option';
import { TsButton } from '@tuvsud/design-system/react/button';

type Props = {
  entities: Array<{ sapCode: string; legalName: string }>;
  divisions: Array<{ divisionCode: string; divisionName: string }>;
  /** Mapa sociedad→divisiones para filtrado en cascada */
  entityDivisionMap: Record<string, string[]>;
  years: number[];
};

const targetValue = (e: Event) => (e.target as HTMLInputElement).value;

// En un TsSelect `multiple`, el `value` (getter y evento) es un ARRAY de strings.
const targetMulti = (e: Event): string[] => {
  const v = (e.target as unknown as { value: string | string[] }).value;
  return Array.isArray(v) ? v : v ? [v] : [];
};

// Filtros multi: en la URL viajan como lista separada por comas.
const parseMulti = (v: string | null): string[] =>
  v ? v.split(',').map(s => s.trim()).filter(Boolean) : [];

export function SegmentationFilters({ entities, divisions, entityDivisionMap, years }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [entity, setEntity] = useState<string[]>(parseMulti(params.get('entity')));
  const [division, setDivision] = useState<string[]>(parseMulti(params.get('division')));
  const [year, setYear] = useState<string[]>(parseMulti(params.get('year')));
  const [ic, setIc] = useState(params.get('ic') ?? '');

  // Re-sincroniza con la URL sin useEffect (ajuste de estado durante el render).
  const paramsKey = params.toString();
  const [prevParamsKey, setPrevParamsKey] = useState(paramsKey);
  if (paramsKey !== prevParamsKey) {
    setPrevParamsKey(paramsKey);
    setEntity(parseMulti(params.get('entity')));
    setDivision(parseMulti(params.get('division')));
    setYear(parseMulti(params.get('year')));
    setIc(params.get('ic') ?? '');
  }

  function apply() {
    const next = new URLSearchParams();
    if (entity.length) next.set('entity', entity.join(','));
    if (division.length) next.set('division', division.join(','));
    if (year.length) next.set('year', year.join(','));
    if (ic) next.set('ic', ic);
    startTransition(() => router.push(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false }));
  }

  function clear() {
    setEntity([]); setDivision([]); setYear([]); setIc('');
    startTransition(() => router.push(pathname, { scroll: false }));
  }

  const hasAny = !!(entity.length || division.length || year.length || ic);

  // Cascada: si hay sociedades seleccionadas, limitar divisiones a las suyas.
  const allowedDivCodes = entity.length > 0
    ? [...new Set(entity.flatMap(e => entityDivisionMap[e] || []))]
    : null;

  return (
    <form
      onSubmit={e => { e.preventDefault(); apply(); }}
      className="grid grid-cols-1 gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]"
      style={{
        background: 'var(--ts-semantic-color-surface-default)',
        borderColor: 'var(--ts-semantic-color-border-base-default)',
      }}
    >
      <TsSelect label="Sociedad" multiple value={entity} placeholder="Todas" clearable
        onTsChange={(e: Event) => setEntity(targetMulti(e))}>
        {entities.map(en => (
          <TsOption key={en.sapCode} value={en.sapCode}>
            {en.sapCode} — {en.legalName.length > 28 ? en.legalName.slice(0, 26) + '…' : en.legalName}
          </TsOption>
        ))}
      </TsSelect>

      <TsSelect label="División" multiple value={division} placeholder="Todas" clearable
        onTsChange={(e: Event) => setDivision(targetMulti(e))}>
        {divisions
          .filter(d => !allowedDivCodes || allowedDivCodes.includes(d.divisionCode))
          .map(d => (
            <TsOption key={d.divisionCode} value={d.divisionCode}>
              {d.divisionCode} — {d.divisionName}
            </TsOption>
          ))}
      </TsSelect>

      <TsSelect label="Año" multiple value={year} placeholder="Todos" clearable
        onTsChange={(e: Event) => setYear(targetMulti(e))}>
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
