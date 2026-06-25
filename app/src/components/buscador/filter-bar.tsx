/**
 * Barra de filtros del Buscador 360 — filtros server-side vía URL searchParams.
 *
 * Filtros agrupados en 3 filas para no saturar:
 *   1) Búsqueda libre
 *   2) Sociedad/División/Provincia/CCAA (geo + organización)
 *   3) Tipo entidad / Rango / Intercompany / Importe mín / flags
 *
 * Client component que usa varios Ts* del DS. Imports desde sub-entries
 * (no del barrel) → safe en SSR sin dynamic({ ssr: false }).
 *
 * Detalle de eventos: los Ts* derivan de Shoelace pero el DS renombra los
 * eventos `sl-*` → `ts-*`, que el wrapper React expone como `onTs*` (camelCase).
 * OJO: usar `onSl*` NO funciona (no se conecta listener). En este archivo:
 *   - TsInput: onTsInput (cada keystroke) / onTsChange (al blur)
 *   - TsSelect: onTsChange (al elegir opción)
 *   - TsCheckbox: onTsChange (al alternar)
 */
'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useTransition, useRef } from 'react';
import { TsInput } from '@tuvsud/design-system/react/input';
import { TsSelect } from '@tuvsud/design-system/react/select';
import { TsOption } from '@tuvsud/design-system/react/option';
import { TsCheckbox } from '@tuvsud/design-system/react/checkbox';
import { TsButton } from '@tuvsud/design-system/react/button';
import { TsIcon } from '@tuvsud/design-system/react/icon';
import { TsSpinner } from '@tuvsud/design-system/react/spinner';
import { TsRadioGroup } from '@tuvsud/design-system/react/radio-group';
import { TsRadioButton } from '@tuvsud/design-system/react/radio-button';
import { CodeMultiCombobox, type CodeItem } from './code-multi-combobox';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
const stripCompanyPrefix = (code: string) => code.replace(/^\d+\//, '');

type EntityType = { code: string; label: string };

type Props = {
  entities: Array<{ sapCode: string; legalName: string }>;
  divisions: Array<{ divisionCode: string; divisionName: string }>;
  /** Mapa sociedad→divisiones para filtrado en cascada */
  entityDivisionMap: Record<string, string[]>;
  ccaas: string[];
  provinces: string[];
  entityTypes: EntityType[];
  /** Divisiones CNAE-2009 ({ code, name }) para el filtro sectorial. */
  cnaes: Array<{ code: string; name: string }>;
  amountRanges: string[];
  intercompany: string[];
  /** Años con facturación disponibles (desc), para el filtro de año. */
  years: number[];
};

// Helper para extraer .value/.checked de un Ts* event (el target es el WC)
const targetValue = (e: Event) => (e.target as HTMLInputElement).value;
const targetChecked = (e: Event) => (e.target as HTMLInputElement).checked;

// En un TsSelect `multiple`, el `value` (getter y evento) es un ARRAY de strings.
// Este helper lo normaliza siempre a string[] (defensivo si llegara un string).
const targetMulti = (e: Event): string[] => {
  const v = (e.target as unknown as { value: string | string[] }).value;
  return Array.isArray(v) ? v : v ? [v] : [];
};

// Filtros multi: en la URL viajan como lista separada por comas.
const parseMulti = (v: string | null): string[] =>
  v ? v.split(',').map(s => s.trim()).filter(Boolean) : [];

// Shoelace (<sl-option>) prohíbe espacios en `value` y los sustituye por '_'.
// CCAA/Provincia son nombres con espacios → los slugificamos al renderizar
// y los restauramos al leerlos, para que la URL y la query vean el nombre real.
// (Imprescindible además para `multiple`: el value múltiple se serializa separando
// por espacios, así que las opciones NO pueden contener espacios.)
// Bijección limpia: ningún nombre de CCAA/provincia contiene un '_' literal.
const geoSlug = (s: string) => s.replace(/ /g, '_');
const geoUnslug = (s: string) => s.replace(/_/g, ' ');

import { AMOUNT_RANGES, pc2CodesForProvince } from '@/lib/spain';

// Carga perezosa de catálogos pesados (materiales ~492, centros de coste ~206): el
// endpoint reaplica el mismo RLS (reutiliza getFilterCatalogs). Así NO viajan en el
// payload RSC de cada carga del buscador; solo se piden al abrir el desplegable.
const loadOptions = (type: 'materials' | 'profitCenters') => (): Promise<CodeItem[]> =>
  fetch(`/api/filter-options?type=${type}`).then(r => (r.ok ? r.json() : []));

export function FilterBar({
  entities, 
  divisions, 
  entityDivisionMap,
  ccaas, 
  provinces, 
  entityTypes,
  cnaes,
  amountRanges,
  intercompany: allowedIntercompany,
  years,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [search, setSearch] = useState(params.get('search') ?? '');
  const [entity, setEntity] = useState<string[]>(parseMulti(params.get('entity')));
  const [division, setDivision] = useState<string[]>(parseMulti(params.get('division')));
  const [ccaa, setCcaa] = useState<string[]>(parseMulti(params.get('ccaa')));
  const [province, setProvince] = useState<string[]>(parseMulti(params.get('province')));
  const [entityType, setEntityType] = useState<string[]>(parseMulti(params.get('entityType')));
  const [range, setRange] = useState<string[]>(parseMulti(params.get('range')));
  const [year, setYear] = useState<string[]>(parseMulti(params.get('year')));
  const [intercompany, setIntercompany] = useState(params.get('intercompany') ?? '');
  const [minAmount, setMinAmount] = useState(params.get('minAmount') ?? '');
  const [cp, setCp] = useState(params.get('cp') ?? '');
  const [pc, setPc] = useState<string[]>(parseMulti(params.get('pc')));
  const [pcMode, setPcMode] = useState(params.get('pcMode') === 'exclude' ? 'exclude' : 'include');
  const [mat, setMat] = useState<string[]>(parseMulti(params.get('mat')));
  const [matMode, setMatMode] = useState(params.get('matMode') === 'exclude' ? 'exclude' : 'include');
  const [cnae, setCnae] = useState<string[]>(parseMulti(params.get('cnae')));
  const [cnaeMode, setCnaeMode] = useState(params.get('cnaeMode') === 'exclude' ? 'exclude' : 'include');
  const [onlyActive, setOnlyActive] = useState(params.get('active12m') === '1');
  const [recurring, setRecurring] = useState(params.get('recurring') === '1');
  const [hideBlocked, setHideBlocked] = useState(params.get('hideBlocked') === '1');

  // Re-sincroniza los inputs cuando cambia la URL (Aplicar, Limpiar, back/forward)
  // sin useEffect: patrón "ajuste de estado durante el render" recomendado por React.
  const paramsKey = params.toString();
  const [prevParamsKey, setPrevParamsKey] = useState(paramsKey);
  if (paramsKey !== prevParamsKey) {
    setPrevParamsKey(paramsKey);
    setSearch(params.get('search') ?? '');
    setEntity(parseMulti(params.get('entity')));
    setDivision(parseMulti(params.get('division')));
    setCcaa(parseMulti(params.get('ccaa')));
    setProvince(parseMulti(params.get('province')));
    setEntityType(parseMulti(params.get('entityType')));
    setRange(parseMulti(params.get('range')));
    setYear(parseMulti(params.get('year')));
    setIntercompany(params.get('intercompany') ?? '');
    setMinAmount(params.get('minAmount') ?? '');
    setCp(params.get('cp') ?? '');
    setPc(parseMulti(params.get('pc')));
    setPcMode(params.get('pcMode') === 'exclude' ? 'exclude' : 'include');
    setMat(parseMulti(params.get('mat')));
    setMatMode(params.get('matMode') === 'exclude' ? 'exclude' : 'include');
    setCnae(parseMulti(params.get('cnae')));
    setCnaeMode(params.get('cnaeMode') === 'exclude' ? 'exclude' : 'include');
    setOnlyActive(params.get('active12m') === '1');
    setRecurring(params.get('recurring') === '1');
    setHideBlocked(params.get('hideBlocked') === '1');
  }

  function buildDraftParams(): URLSearchParams {
    const next = new URLSearchParams();
    const values: Record<string, string | undefined> = {
      page: '1', // Al aplicar filtros siempre volvemos a la página 1, lo que además fuerza el trigger de búsqueda
      search: search || undefined,
      entity: entity.length ? entity.join(',') : undefined,
      division: division.length ? division.join(',') : undefined,
      ccaa: ccaa.length ? ccaa.join(',') : undefined,
      province: province.length ? province.join(',') : undefined,
      entityType: entityType.length ? entityType.join(',') : undefined,
      range: range.length ? range.join(',') : undefined,
      year: year.length ? year.join(',') : undefined,
      intercompany: intercompany || undefined,
      minAmount: minAmount || undefined,
      cp: cp || undefined,
      pc: pc.length ? pc.join(',') : undefined,
      pcMode: pc.length && pcMode === 'exclude' ? 'exclude' : undefined,
      mat: mat.length ? mat.join(',') : undefined,
      matMode: mat.length && matMode === 'exclude' ? 'exclude' : undefined,
      cnae: cnae.length ? cnae.join(',') : undefined,
      cnaeMode: cnae.length && cnaeMode === 'exclude' ? 'exclude' : undefined,
      active12m: onlyActive ? '1' : undefined,
      recurring: recurring ? '1' : undefined,
      hideBlocked: hideBlocked ? '1' : undefined,
    };
    for (const [k, v] of Object.entries(values)) {
      if (v != null && v !== '') next.set(k, v);
    }
    return next;
  }

  function apply() {
    const next = buildDraftParams();
    next.set('page', '1'); // Al aplicar filtros siempre volvemos a la página 1
    
    
    // Validación CP: si el usuario no tiene acceso a la provincia del CP, limpiamos
    if (cp && cp.length >= 2) {
      const allowedPc2 = new Set(provinces.flatMap((p: string) => pc2CodesForProvince(p)));
      if (!allowedPc2.has(cp.substring(0, 2))) {
        alert(`No tienes permisos para buscar el código postal ${cp} (provincia no permitida).`);
        return;
      }
    }

    if (params.get('view') === 'whitespot') {
      next.set('view', 'whitespot');
    }
    
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  function validateExport(): string | null {
    if (params.get('view') === 'whitespot') {
      return 'La exportación a CSV solo está disponible para la lista de Clientes, no para Whitespots.';
    }

    const currentParams = new URLSearchParams(params.toString());

    // Misma condición que clientes/page.tsx para el estado "Empieza a buscar"
    const QUERY_KEYS = [
      'search', 'entity', 'division', 'ccaa', 'province', 'entityType', 'range',
      'cp', 'pc', 'pcMode', 'mat', 'matMode', 'cnae', 'cnaeMode', 'intercompany', 'minAmount',
      'active12m', 'recurring', 'hideBlocked', 'year', 'sort', 'dir', 'page',
    ];
    const hasQuery = QUERY_KEYS.some(k => {
      const v = currentParams.get(k);
      return v != null && v !== '';
    });

    if (!hasQuery) {
      return 'No hay registros visibles en la tabla. Aplica al menos un filtro de búsqueda para poder exportar a CSV.';
    }

    const draft = buildDraftParams();
    const filterKeys = [
      'search', 'entity', 'division', 'ccaa', 'province', 'entityType', 'range',
      'year', 'intercompany', 'minAmount', 'cp', 'pc', 'pcMode', 'mat', 'matMode',
      'cnae', 'cnaeMode', 'active12m', 'recurring', 'hideBlocked'
    ];

    for (const key of filterKeys) {
      if ((currentParams.get(key) || '') !== (draft.get(key) || '')) {
        return 'Tienes filtros sin aplicar. Por favor, haz clic en el botón "Aplicar" antes de intentar exportar el CSV.';
      }
    }

    return null;
  }

  function clear() {
    setSearch(''); setEntity([]); setDivision([]); setCcaa([]); setProvince([]);
    setEntityType([]); setRange([]); setYear([]); setIntercompany(''); setMinAmount('');
    setCp(''); setPc([]); setPcMode('include'); setMat([]); setMatMode('include');
    setCnae([]); setCnaeMode('include');
    setOnlyActive(false); setRecurring(false); setHideBlocked(false);
    startTransition(() => router.push(pathname, { scroll: false }));
  }

  const hasAny = !!(search || entity.length || division.length || ccaa.length ||
    province.length || entityType.length || range.length || year.length || cp || pc.length || mat.length ||
    cnae.length || intercompany || minAmount || onlyActive || recurring || hideBlocked);

  return (
    <form
      onSubmit={e => { e.preventDefault(); apply(); }}
      className="space-y-4 rounded-lg border bg-card text-card-foreground p-5"
    >
      {/* Overlay "Cargando datos…" mientras se aplica la búsqueda */}
      <LoadingOverlay isPending={pending} />

      {/* Fila 1: Búsqueda */}
      <TsInput
        type="search"
        label="Buscar"
        value={search}
        placeholder="CIF, razón social o código SAP…"
        clearable
        onTsInput={(e: Event) => setSearch(targetValue(e))}
        onTsClear={() => setSearch('')}
      >
        <TsIcon slot="prefix" name="search" />
      </TsInput>

      {/* Fila 2: Geo + organización (4 cols) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TsSelect
          label="Sociedad TÜV"
          multiple
          value={entity}
          placeholder="Todas"
          clearable
          onTsChange={(e: Event) => setEntity(targetMulti(e))}
        >
          {entities.map(en => (
            <TsOption key={en.sapCode} value={en.sapCode}>
              {en.sapCode} — {en.legalName.length > 28 ? en.legalName.slice(0, 26) + '…' : en.legalName}
            </TsOption>
          ))}
        </TsSelect>

        <TsSelect
          label="División"
          multiple
          value={division}
          placeholder="Todas"
          clearable
          onTsChange={(e: Event) => setDivision(targetMulti(e))}
        >
          {(() => {
            // Cascada: si hay sociedades seleccionadas, solo mostrar divisiones de esas sociedades
            const allowedDivCodes = entity.length > 0
              ? [...new Set(entity.flatMap(e => entityDivisionMap[e] || []))]
              : null;
            return divisions
              .filter(d => !allowedDivCodes || allowedDivCodes.includes(d.divisionCode))
              .map(d => (
                <TsOption key={d.divisionCode} value={d.divisionCode}>
                  {d.divisionCode} — {d.divisionName}
                </TsOption>
              ));
          })()}
        </TsSelect>

        <TsSelect
          label="CCAA"
          multiple
          value={ccaa.map(geoSlug)}
          placeholder="Todas"
          clearable
          onTsChange={(e: Event) => setCcaa(targetMulti(e).map(geoUnslug))}
        >
          {ccaas.map(c => <TsOption key={c} value={geoSlug(c)}>{c}</TsOption>)}
        </TsSelect>

        <TsSelect
          label="Provincia"
          multiple
          value={province.map(geoSlug)}
          placeholder="Todas"
          clearable
          onTsChange={(e: Event) => setProvince(targetMulti(e).map(geoUnslug))}
        >
          {provinces.map(p => <TsOption key={p} value={geoSlug(p)}>{p}</TsOption>)}
        </TsSelect>
      </div>

      {/* Fila 3: Tipo entidad + Rango + Año + Intercompany (4 cols) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TsSelect
          label="Tipo entidad"
          multiple
          value={entityType}
          placeholder="Todos"
          clearable
          onTsChange={(e: Event) => setEntityType(targetMulti(e))}
        >
          {entityTypes.map((et) => (
            <TsOption key={et.code} value={et.code}>
              {et.code} — {et.label}
            </TsOption>
          ))}
        </TsSelect>

        <TsSelect
          label="Rango facturado"
          multiple
          value={range}
          placeholder="Todos"
          clearable
          onTsChange={(e: Event) => setRange(targetMulti(e))}
        >
          {AMOUNT_RANGES.filter(r => amountRanges.includes(r.code)).map(r => (
            <TsOption key={r.code} value={r.code}>{r.label}</TsOption>
          ))}
        </TsSelect>

        <TsSelect
          label="Año de facturación"
          multiple
          value={year}
          placeholder="Todos"
          clearable
          onTsChange={(e: Event) => setYear(targetMulti(e))}
        >
          {years.map(y => (
            <TsOption key={y} value={String(y)}>{y}</TsOption>
          ))}
        </TsSelect>

        <TsSelect
          label="Intercompany (grupo)"
          value={intercompany}
          placeholder="Todos"
          clearable
          onTsChange={(e: Event) => setIntercompany(targetValue(e))}
        >
          {allowedIntercompany.includes('1') && <TsOption value="1">Solo intercompany</TsOption>}
          {allowedIntercompany.includes('0') && <TsOption value="0">Excluir intercompany</TsOption>}
        </TsSelect>
      </div>

      {/* Fila 4: CP + Importe mín + Centro de coste + Material + CNAE (los tres últimos incluir/excluir) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <TsInput
          label="Código postal"
          value={cp}
          placeholder="p. ej. 28 o 28001"
          clearable
          onTsInput={(e: Event) => setCp(targetValue(e))}
          onTsClear={() => setCp('')}
        />
        <TsInput
          type="number"
          label="Facturado mín. (€)"
          value={minAmount}
          placeholder="0"
          onTsInput={(e: Event) => setMinAmount(targetValue(e))}
        />
        <div>
          <CodeMultiCombobox
            label="Centro de coste"
            loadItems={loadOptions('profitCenters')}
            value={pc}
            onChange={setPc}
            mode={pcMode}
            displayCode={stripCompanyPrefix}
          />
          <IncludeExcludeToggle mode={pcMode} onMode={setPcMode} />
        </div>
        <div>
          <CodeMultiCombobox
            label="Material / servicio"
            loadItems={loadOptions('materials')}
            value={mat}
            onChange={setMat}
            mode={matMode}
          />
          <IncludeExcludeToggle mode={matMode} onMode={setMatMode} />
        </div>
        <div>
          <CodeMultiCombobox
            label="CNAE (división)"
            items={cnaes}
            value={cnae}
            onChange={setCnae}
            mode={cnaeMode}
            placeholder="Código o actividad…"
          />
          <IncludeExcludeToggle mode={cnaeMode} onMode={setCnaeMode} />
        </div>
      </div>

      {/* Fila 5: flags + botones */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <TsCheckbox
            checked={onlyActive}
            onTsChange={(e: Event) => setOnlyActive(targetChecked(e))}
          >
            Activos últimos 12 meses
          </TsCheckbox>
          <TsCheckbox
            checked={recurring}
            onTsChange={(e: Event) => setRecurring(targetChecked(e))}
          >
            Recurrentes (≥ 2 años)
          </TsCheckbox>
          <TsCheckbox
            checked={hideBlocked}
            onTsChange={(e: Event) => setHideBlocked(targetChecked(e))}
          >
            Ocultar BLOCKED / sin CIF
          </TsCheckbox>
        </div>

        <div className="flex gap-2">
          {hasAny && (
            <TsButton variant="text" onClick={clear}>
              Limpiar
            </TsButton>
          )}
          <ExportCsvButton params={params.toString()} onValidate={validateExport} />
          <TsButton variant="primary" type="submit" disabled={pending} loading={pending}>
            Aplicar
          </TsButton>
        </div>
      </div>
    </form>
  );
}

// Filtro de código con modo Incluir/Excluir (segmentado). Reutilizado por
// Centro de coste y Material — mismo patrón positivo/negativo en un solo control.
// Toggle segmentado Incluir/Excluir, reutilizado por los filtros positivo/negativo.
function IncludeExcludeToggle({ mode, onMode }: { mode: string; onMode: (v: string) => void }) {
  return (
    <div className="mt-1.5">
      <TsRadioGroup size="small" value={mode} onTsChange={(e: Event) => onMode(targetValue(e))}>
        <TsRadioButton value="include">Incluir</TsRadioButton>
        <TsRadioButton value="exclude">Excluir</TsRadioButton>
      </TsRadioGroup>
    </div>
  );
}

function ExportCsvButton({ params, onValidate }: { params: string, onValidate: () => string | null }) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportAlert, setExportAlert] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const href = `/api/clientes/export${params ? '?' + params : ''}`;

  async function handleExport(e: React.MouseEvent) {
    e.preventDefault();
    
    const validationError = onValidate();
    if (validationError) {
      setExportAlert(validationError);
      return;
    }

    setIsExporting(true);
    abortControllerRef.current = new AbortController();
    
    try {
      // 1. Verificamos si hay registros primero (muy rápido por la RAM_CACHE)
      const checkHref = href + (href.includes('?') ? '&' : '?') + 'checkOnly=1';
      const response = await fetch(checkHref, { signal: abortControllerRef.current.signal });
      
      if (!response.ok) throw new Error('Error al chequear disponibilidad');
      
      const { total } = await response.json();
      
      if (total === 0) {
        setExportAlert('No hay registros a exportar con los filtros actuales.');
        setIsExporting(false);
        abortControllerRef.current = null;
        return;
      }
      
      // 2. Hay registros: dejamos que el navegador gestione la descarga en stream
      // Esto evita cargar 100MB de texto en un Blob en la RAM de la pestaña.
      // Usamos window.location.href en lugar de target='_blank' para evitar bloqueadores de popups
      // si la respuesta async tarda más de 1 segundo.
      window.location.href = href;
      
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') {
        console.log('Comprobación de exportación cancelada');
      } else {
        console.error(error);
        setExportAlert('Hubo un problema al inicializar la exportación.');
      }
    } finally {
      // Cerramos el modal de cargando inmediatamente porque la descarga ya la gestiona el navegador nativamente.
      setIsExporting(false);
      abortControllerRef.current = null;
    }
  }

  function cancelExport() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }

  return (
    <>
      <TsButton variant="default" onClick={handleExport} disabled={isExporting} type="button">
        <TsIcon slot="prefix" name="download" />
        CSV
      </TsButton>
      
      {isExporting && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20">
          <div 
            className="flex flex-col items-center justify-center gap-5 rounded-xl p-8 shadow-2xl border min-w-[300px] relative"
            style={{ 
              background: 'var(--ts-semantic-color-surface-default)', 
              color: 'var(--ts-semantic-color-text-primary-default)',
              borderColor: 'var(--ts-semantic-color-border-base-default)'
            }}
          >
            <TsSpinner style={{ fontSize: '2.5rem' }}></TsSpinner>
            <div className="text-center">
              <p className="text-lg font-medium m-0">Exportando CSV...</p>
              <p className="text-sm opacity-70 m-0 mt-1">Esto puede tardar unos segundos.</p>
            </div>
            <TsButton variant="primary" onClick={cancelExport} type="button" className="mt-2 w-full">
              Cancelar
            </TsButton>
          </div>
        </div>
      )}

      {exportAlert && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20">
          <div 
            className="flex flex-col items-center justify-center gap-5 rounded-xl p-8 shadow-2xl border max-w-[400px] text-center"
            style={{ 
              background: 'var(--ts-semantic-color-surface-default)', 
              color: 'var(--ts-semantic-color-text-primary-default)',
              borderColor: 'var(--ts-semantic-color-border-base-default)'
            }}
          >
            <TsIcon name="warning" className="text-4xl text-yellow-500" />
            <div className="text-center">
              <p className="text-lg font-medium m-0">Aviso</p>
              <p className="text-sm opacity-70 m-0 mt-2">{exportAlert}</p>
            </div>
            <TsButton variant="primary" onClick={() => setExportAlert(null)} type="button" className="mt-2 w-full">
              Aceptar
            </TsButton>
          </div>
        </div>
      )}
    </>
  );
}
