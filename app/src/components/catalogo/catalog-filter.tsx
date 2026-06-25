/**
 * Barra de filtros del catálogo — sincronizada con URL searchParams.
 *
 * Misma decisión que filter-bar.tsx: client + Ts* desde sub-entries (no del
 * barrel) — safe en SSR.
 */
'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useTransition } from 'react';
import { TsInput } from '@tuvsud/design-system/react/input';
import { TsSelect } from '@tuvsud/design-system/react/select';
import { TsOption } from '@tuvsud/design-system/react/option';
import { TsButton } from '@tuvsud/design-system/react/button';
import { TsIcon } from '@tuvsud/design-system/react/icon';

type Props = {
  categories: Array<{ category: string; count: number }>;
};

const targetValue = (e: Event) => (e.target as HTMLInputElement).value;

// Shoelace (<sl-option>) prohíbe espacios en `value` y los sustituye por '_'.
// Las Business Lines llevan espacios → slugificar al renderizar y restaurar al
// leer, para que la URL y la query vean el nombre real. Bijección limpia: las
// categorías no contienen un '_' literal.
const slugVal = (s: string) => s.replace(/ /g, '_');
const unslugVal = (s: string) => s.replace(/_/g, ' ');

export function CatalogFilter({ categories }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [search, setSearch] = useState(params.get('search') ?? '');
  const [category, setCategory] = useState(params.get('category') ?? '');

  // Re-sincroniza con la URL sin useEffect (ajuste de estado durante el render).
  const paramsKey = params.toString();
  const [prevParamsKey, setPrevParamsKey] = useState(paramsKey);
  if (paramsKey !== prevParamsKey) {
    setPrevParamsKey(paramsKey);
    setSearch(params.get('search') ?? '');
    setCategory(params.get('category') ?? '');
  }

  function apply() {
    const next = new URLSearchParams();
    if (search) next.set('search', search);
    if (category) next.set('category', category);
    startTransition(() => router.push(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false }));
  }

  function clear() {
    setSearch(''); setCategory('');
    startTransition(() => router.push(pathname, { scroll: false }));
  }

  const hasAny = !!(search || category);
  const totalCount = categories.reduce((s, c) => s + c.count, 0);

  return (
    <form
      onSubmit={e => { e.preventDefault(); apply(); }}
      className="flex flex-col gap-3 rounded-lg border p-4 lg:flex-row lg:items-end"
      style={{
        background: 'var(--ts-semantic-color-surface-default)',
        borderColor: 'var(--ts-semantic-color-border-base-default)',
      }}
    >
      <div className="flex-1">
        <TsInput
          type="search"
          label="Buscar"
          value={search}
          placeholder="Código material, descripción, servicio…"
          clearable
          onTsInput={(e: Event) => setSearch(targetValue(e))}
          onTsClear={() => setSearch('')}
        >
          <TsIcon slot="prefix" name="search" />
        </TsInput>
      </div>

      <div className="min-w-[200px]">
        <TsSelect
          label="Business Line"
          value={slugVal(category)}
          placeholder={`Todas (${totalCount})`}
          clearable
          onTsChange={(e: Event) => setCategory(unslugVal(targetValue(e)))}
        >
          {categories.map(c => (
            <TsOption key={c.category} value={slugVal(c.category)}>
              {c.category} ({c.count})
            </TsOption>
          ))}
        </TsSelect>
      </div>

      <div className="flex gap-2">
        {hasAny && (
          <TsButton variant="text" onClick={clear}>
            Limpiar
          </TsButton>
        )}
        <TsButton variant="primary" type="submit" disabled={pending} loading={pending}>
          Aplicar
        </TsButton>
      </div>
    </form>
  );
}
