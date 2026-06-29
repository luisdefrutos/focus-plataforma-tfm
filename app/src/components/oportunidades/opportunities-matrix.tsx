'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { type OpportunityMatrixResult } from '@/lib/queries/customers';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { TsSpinner } from '@tuvsud/design-system/react/spinner';
import { TsButton } from '@tuvsud/design-system/react/button';
import { TsIcon } from '@tuvsud/design-system/react/icon';

export function OpportunitiesMatrix({ data }: { data: OpportunityMatrixResult }) {
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [showColMenu, setShowColMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [exportAlert, setExportAlert] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowColMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allCols = data?.materialColumns || [];
  const visibleCols = allCols.filter(c => !hiddenCols.has(c.materialCode));

  const maxPerCol = useMemo(() => {
    const res: Record<string, number> = {};
    if (!data?.rows) return res;
    for (const c of allCols) {
      res[c.materialCode] = Math.max(...data.rows.map(r => r.amounts[c.materialCode] || 0));
    }
    return res;
  }, [allCols, data]);

  const toggleCol = (code: string) => {
    setHiddenCols(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  if (!data || data.rows.length === 0) {
    return null;
  }

  const handleExportCSV = async () => {
    if (isExporting) return;
    setIsExporting(true);
    abortControllerRef.current = new AbortController();
    
    try {
      const searchParams = new URLSearchParams(window.location.search);
      if (hiddenCols.size > 0) {
        searchParams.set('excludeExportCols', Array.from(hiddenCols).join(','));
      }
      
      const href = `/api/oportunidades/export?${searchParams.toString()}`;
      const checkHref = href + '&checkOnly=1';
      
      const response = await fetch(checkHref, { signal: abortControllerRef.current.signal });
      if (!response.ok) throw new Error('Error al chequear disponibilidad');
      
      const { total } = await response.json();
      if (total === 0) {
        setExportAlert('No hay registros a exportar con los filtros actuales.');
        return;
      }
      
      // Realizar la descarga mediante fetch para mantener el modal activo
      const exportResponse = await fetch(href, { signal: abortControllerRef.current.signal });
      if (!exportResponse.ok) throw new Error('Error al descargar el CSV');
      
      const blob = await exportResponse.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      
      // Extraer el nombre del archivo del header si es posible
      const disposition = exportResponse.headers.get('Content-Disposition');
      let filename = 'Oportunidades.csv';
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (error) {
      if ((error as { name?: string })?.name !== 'AbortError') {
        console.error(error);
        setExportAlert('Hubo un problema al exportar.');
      }
    } finally {
      setIsExporting(false);
      abortControllerRef.current = null;
    }
  };

  const toggleAllCols = () => {
    if (hiddenCols.size > 0) {
      setHiddenCols(new Set()); // Mostrar todos
    } else {
      setHiddenCols(new Set(allCols.map(c => c.materialCode))); // Ocultar todos
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowColMenu(!showColMenu)}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted text-foreground"
          >
            <Icon name="view_column" size={16} />
            Columnas
          </button>
          
          {showColMenu && (
            <div 
              className="absolute right-0 top-full mt-1 w-72 rounded-md border border-border shadow-lg z-50 flex flex-col bg-popover max-h-[400px]"
            >
              <div className="p-2 border-b border-border bg-muted/50 flex justify-between items-center">
                <p className="text-xs font-semibold text-muted-foreground">
                  Mostrar / Ocultar Servicios
                </p>
                <button 
                  onClick={toggleAllCols}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  {hiddenCols.size > 0 ? 'Marcar todos' : 'Desmarcar todos'}
                </button>
              </div>
              <div className="overflow-y-auto p-2 space-y-1 flex-1">
                {allCols.map(c => (
                  <label key={c.materialCode} className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-sm">
                    <input 
                      type="checkbox" 
                      checked={!hiddenCols.has(c.materialCode)}
                      onChange={() => toggleCol(c.materialCode)}
                      className="rounded border-input"
                    />
                    <span className="truncate flex-1" title={c.description}>
                      <span className="font-mono text-xs text-muted-foreground mr-2">{c.materialCode}</span>
                      {c.description}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <TsButton
          variant="secondary"
          onClick={handleExportCSV}
          disabled={isExporting}
          type="button"
        >
          <TsIcon slot="prefix" name="download" />
          Exportar a CSV
        </TsButton>
      </div>

      {isExporting && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20">
          <div 
            className="flex flex-col items-center justify-center gap-5 rounded-xl p-8 shadow-2xl border border-border min-w-[300px] relative bg-background text-foreground"
          >
            <TsSpinner style={{ fontSize: '2.5rem' }}></TsSpinner>
            <div className="text-center">
              <p className="text-lg font-medium m-0">Exportando CSV...</p>
              <p className="text-sm opacity-70 m-0 mt-1">Esto puede tardar unos segundos.</p>
            </div>
            <TsButton variant="primary" onClick={() => abortControllerRef.current?.abort()} type="button" className="mt-2 w-full">
              Cancelar
            </TsButton>
          </div>
        </div>
      )}

      {exportAlert && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20">
          <div 
            className="flex flex-col items-center justify-center gap-5 rounded-xl p-8 shadow-2xl border border-border max-w-[400px] text-center bg-background text-foreground"
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

      <div 
        className="relative w-full overflow-hidden rounded-lg border border-border shadow-sm bg-background"
      >
        <div className="overflow-auto max-h-[800px]">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="sticky top-0 z-30 bg-background text-muted-foreground">
              <tr className="border-b border-border">
                <th 
                  className="px-4 py-3 font-semibold uppercase tracking-wider text-xs md:sticky md:left-0 z-40 border-r border-border bg-background"
                  style={{ 
                    width: '300px',
                    minWidth: '300px',
                    maxWidth: '300px'
                  }}
                >
                  Cliente
                </th>
                <th 
                  className="px-4 py-3 font-semibold uppercase tracking-wider text-xs text-right md:sticky md:left-[300px] z-40 bg-background"
                  style={{ 
                    width: '140px',
                    minWidth: '140px',
                    maxWidth: '140px',
                    boxShadow: '1px 0 0 0 hsl(var(--border))'
                  }}
                >
                  Total Facturado
                </th>
                {visibleCols.map(c => (
                  <th 
                    key={c.materialCode} 
                    className="px-4 py-3 font-semibold text-xs text-right whitespace-normal leading-tight border-l border-border"
                    style={{ minWidth: '160px', maxWidth: '200px' }}
                    title={c.description}
                  >
                    <div className="font-mono text-[10px] text-muted-foreground mb-1">{c.materialCode}</div>
                    <div>{c.description}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr 
                  key={row.entityKey} 
                  className="border-b border-border transition-colors group hover:bg-muted/50"
                >
                  <td 
                    className="px-4 py-2.5 font-medium md:sticky md:left-0 z-10 border-r border-border bg-background group-hover:bg-muted/50"
                    style={{ 
                      width: '300px',
                      minWidth: '300px',
                      maxWidth: '300px'
                    }}
                  >
                    <Link 
                      href={`/clientes/${row.customerId}?from=oportunidades`}
                      className="block truncate text-sm text-primary hover:underline"
                      title={row.legalName}
                    >
                      {row.legalName}
                    </Link>
                    <div className="text-xs truncate font-normal text-muted-foreground">
                      {row.taxId}
                      {row.sapCustomerCode && <> · SAP {row.sapCustomerCode}</>}
                    </div>
                  </td>
                  <td 
                    className="px-4 py-2.5 text-right font-semibold tabular-nums md:sticky md:left-[300px] z-10 text-foreground bg-background group-hover:bg-muted/50"
                    style={{ 
                      width: '140px',
                      minWidth: '140px',
                      maxWidth: '140px',
                      boxShadow: '1px 0 0 0 hsl(var(--border))'
                    }}
                  >
                    {formatCurrency(row.total)}
                  </td>
                  {visibleCols.map(c => {
                    const amount = row.amounts[c.materialCode];
                    
                    if (!amount) {
                      return (
                        <td key={c.materialCode} className="px-4 py-2.5 text-right tabular-nums text-sm border-l border-border">
                          {/* Celda vacía, sin guion, sin color */}
                        </td>
                      );
                    }

                    return (
                      <td 
                        key={c.materialCode} 
                        className="px-4 py-2.5 text-right tabular-nums text-sm transition-colors hover:bg-accent border-l border-border text-foreground"
                      >
                        {formatCurrency(amount)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 z-30 font-bold bg-background text-foreground">
              <tr style={{ boxShadow: '0 -1px 0 0 hsl(var(--border))' }}>
                <td 
                  className="px-4 py-3 sticky left-0 z-40 border-r border-border bg-background"
                  style={{ 
                    width: '300px',
                    minWidth: '300px',
                    maxWidth: '300px'
                  }}
                >
                  Total página ({data.rows.length})
                </td>
                <td 
                  className="px-4 py-3 text-right sticky left-[300px] z-40 bg-background"
                  style={{ 
                    width: '140px',
                    minWidth: '140px',
                    maxWidth: '140px',
                    boxShadow: '1px 0 0 0 hsl(var(--border))'
                  }}
                >
                  {formatCurrency(data.rows.reduce((sum, row) => sum + row.total, 0))}
                </td>
                {visibleCols.map(c => (
                  <td 
                    key={c.materialCode} 
                    className="px-4 py-3 text-right border-l border-border"
                  >
                    {formatCurrency(c.totalAmount)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {exportAlert && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20">
          <div 
            className="flex flex-col items-center justify-center gap-5 rounded-xl p-8 shadow-2xl border border-border max-w-[400px] text-center bg-background text-foreground"
          >
            <Icon name="warning" className="text-4xl text-yellow-500" />
            <div className="text-center">
              <p className="text-lg font-medium m-0">Aviso</p>
              <p className="text-sm opacity-70 m-0 mt-2">{exportAlert}</p>
            </div>
            <button 
              onClick={() => setExportAlert(null)} 
              type="button" 
              className="mt-2 w-full rounded-md px-4 py-2 text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Aceptar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
