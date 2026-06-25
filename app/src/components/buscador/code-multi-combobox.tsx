/**
 * Combobox multi-selección genérico sobre un catálogo de { code, name }.
 * Typeahead que filtra por código O por nombre; cada elemento elegido se muestra
 * como chip eliminable, coloreado según el modo Incluir/Excluir.
 *
 * El valor es la lista de códigos seleccionados (coincidencia exacta en la query).
 * Reutilizado por Centro de coste y Material/servicio.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { TsInput } from '@tuvsud/design-system/react/input';
import { TsIcon } from '@tuvsud/design-system/react/icon';

export type CodeItem = { code: string; name: string };

const targetValue = (e: Event) => (e.target as HTMLInputElement).value;
const MAX_RESULTS = 50;

export function CodeMultiCombobox({
  value,
  onChange,
  items = [],
  loadItems,
  label,
  mode = 'include',
  placeholder = 'Código o nombre…',
  displayCode = (c: string) => c,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  /** Catálogo estático. Con `loadItems` actúa solo como valor inicial (por defecto vacío). */
  items?: CodeItem[];
  /** Carga perezosa del catálogo: se invoca al abrir (o al montar si hay valores preseleccionados). */
  loadItems?: () => Promise<CodeItem[]>;
  label: string;
  mode?: string;
  placeholder?: string;
  displayCode?: (code: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Catálogo cargado de forma perezosa (null = aún no cargado); si existe, prevalece sobre `items`.
  const [fetched, setFetched] = useState<CodeItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef(false);
  const ref = useRef<HTMLDivElement>(null);
  const effItems = fetched ?? items;

  // Dispara la carga perezosa una sola vez (al abrir o si hay chips preseleccionados).
  const ensureLoaded = () => {
    if (!loadItems || loadedRef.current) return;
    loadedRef.current = true;
    setLoading(true);
    loadItems().then(setFetched).catch(() => setFetched([])).finally(() => setLoading(false));
  };
  useEffect(() => {
    if (value.length > 0) ensureLoaded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nameOf = (code: string) => effItems.find(c => c.code === code)?.name ?? '';
  const chipStyle = mode === 'exclude'
    ? {
        background: 'var(--ts-semantic-color-background-danger-subtle-default)',
        color: 'var(--ts-semantic-color-text-danger-default)',
      }
    : {
        background: 'var(--ts-semantic-color-background-primary-subtle-default)',
        color: 'var(--ts-semantic-color-text-link-default)',
      };

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  const q = query.trim().toLowerCase();
  const selected = new Set(value);
  const matches = effItems
    .filter(c => !selected.has(c.code))
    .filter(c => !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
    .slice(0, MAX_RESULTS);

  function add(code: string) {
    if (!value.includes(code)) onChange([...value, code]);
    setQuery('');
    setOpen(true);
  }
  function remove(code: string) {
    onChange(value.filter(c => c !== code));
  }

  return (
    <div ref={ref} className="relative">
      <TsInput
        label={label}
        value={query}
        placeholder={value.length ? 'Añadir otro…' : placeholder}
        clearable
        onTsFocus={() => { setOpen(true); ensureLoaded(); }}
        onTsInput={(e: Event) => { setQuery(targetValue(e)); setOpen(true); }}
        onTsClear={() => setQuery('')}
      >
        <TsIcon slot="suffix" name="expand_more" />
      </TsInput>

      {value.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {value.map(code => (
            <span
              key={code}
              
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${mode === 'exclude' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}
              title={`${code} (${nameOf(code)})`}
            >
              <span className="font-mono">{displayCode(code)}</span>
              <button
                type="button"
                onClick={() => remove(code)}
                aria-label={`Quitar ${code}`}
                className="leading-none opacity-70 hover:opacity-100"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {open && loading && (
        <div
          
          className="absolute z-20 mt-1 w-full rounded-md border bg-popover text-muted-foreground px-3 py-2 text-sm shadow-lg"
        >
          Cargando opciones…
        </div>
      )}

      {open && !loading && matches.length > 0 && (
        <ul
          
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover text-popover-foreground py-1 shadow-lg"
        >
          {matches.map(c => (
            <li key={c.code}>
              <button
                type="button"
                className="block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                onMouseDown={e => { e.preventDefault(); add(c.code); }}
                title={`${c.code} (${c.name})`}
              >
                <span className="font-mono">{displayCode(c.code)}</span>{' '}
                <span className="text-muted-foreground">
                  ({c.name})
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
