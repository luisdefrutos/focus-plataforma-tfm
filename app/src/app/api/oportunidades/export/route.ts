/**
 * Export CSV de Oportunidades (Matriz) — aplica los mismos filtros y RLS, y vuelca
 * TODO el resultado en streaming (sin tope de filas). Las columnas son las MISMAS que
 * la matriz de la tabla: solo los Material Codes con facturación > 0 en el resultado
 * completo (no el catálogo entero), ordenados por descripción y respetando las
 * columnas que el usuario haya ocultado (excludeExportCols). Protección anti-abuso:
 * rate-limiting por usuario y tope de valores por filtro.
 */

import { NextRequest, after } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOpportunitiesMatrixUncached, type CustomerSearchOpts } from '@/lib/queries/customers';
import { recordAuditEvent, clientInfoFromRequest } from '@/lib/audit';
import { csvCell } from '@/lib/csv';
import { consume } from '@/lib/rate-limit';

const MAX_FILTER_VALUES = 500; // tope de valores por filtro multi-selección (anti-DoS, CWE-1284)

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response('No autorizado', { status: 401 });
  }

  // Rate-limiting de exportaciones por usuario (consultas pesadas; CWE-770).
  const rl = consume(`export:oportunidades:${session.user.id ?? session.user.email ?? 'anon'}`,
    { limit: 30, windowMs: 5 * 60_000, blockMs: 5 * 60_000 });
  if (!rl.ok) {
    return new Response('Demasiadas exportaciones. Inténtalo de nuevo en unos minutos.', {
      status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
    });
  }

  const sp = req.nextUrl.searchParams;
  const ic = sp.get('intercompany');
  const intercompany: '0' | '1' | undefined = ic === '0' ? '0' : ic === '1' ? '1' : undefined;
  const getMulti = (k: string): string[] | undefined => {
    const v = sp.get(k);
    if (!v) return undefined;
    const arr = v.split(',').map(s => s.trim()).filter(Boolean).slice(0, MAX_FILTER_VALUES);
    return arr.length > 0 ? arr : undefined;
  };
  const fiscalYears = getMulti('year')?.map(Number).filter(n => Number.isInteger(n) && n > 1900);

  const opts: CustomerSearchOpts = {
    search: sp.get('search') ?? undefined,
    entitySapCodes: getMulti('entity'),
    divisionCodes: getMulti('division'),
    ccaas: getMulti('ccaa'),
    provinces: getMulti('province'),
    entityTypes: getMulti('entityType'),
    amountRanges: getMulti('range'),
    postalCode: sp.get('cp') ?? undefined,
    profitCenterCodes: getMulti('pc') && sp.get('pcMode') !== 'exclude' ? getMulti('pc') : undefined,
    excludeProfitCenterCodes: getMulti('pc') && sp.get('pcMode') === 'exclude' ? getMulti('pc') : undefined,
    materialCodes: getMulti('mat') && sp.get('matMode') !== 'exclude' ? getMulti('mat') : undefined,
    excludeMaterialCodes: getMulti('mat') && sp.get('matMode') === 'exclude' ? getMulti('mat') : undefined,
    cnaeCodes: getMulti('cnae') && sp.get('cnaeMode') !== 'exclude' ? getMulti('cnae') : undefined,
    excludeCnaeCodes: getMulti('cnae') && sp.get('cnaeMode') === 'exclude' ? getMulti('cnae') : undefined,
    intercompany,
    fiscalYears: fiscalYears && fiscalYears.length ? fiscalYears : undefined,
    minAmount: sp.get('minAmount') ? Number(sp.get('minAmount')) : undefined,
    onlyActive12m: sp.get('active12m') === '1',
    recurringOnly: sp.get('recurring') === '1',
    hideBlocked: sp.get('hideBlocked') === '1',
    exportAll: true,
    page: 1,
    pageSize: 5000, // Chunk size
    buIds: session.user.buIds ?? [],
    allowedFilters: session.user.allowedFilters ?? undefined,
    group: (sp.get('group') as 'org' | 'sap') ?? 'org',
  };

  // 1. Fetch total to know if we have records
  const firstPage = await getOpportunitiesMatrixUncached(opts);
  const total = firstPage.total;

  if (sp.get('checkOnly') === '1') {
    return new Response(JSON.stringify({ total }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Auditar la exportación real (el preflight ?checkOnly no se registra). Se ejecuta
  // tras enviar la respuesta para no retrasar el stream. `reexportOf` (id del evento
  // reexportado desde /auditoria) se saca de los filtros y se anota aparte.
  const reexportOf = sp.get('reexportOf');
  const exportFilters = Object.fromEntries([...sp.entries()].filter(([k]) => k !== 'checkOnly' && k !== 'reexportOf'));
  const clientInfo = clientInfoFromRequest(req);
  after(() =>
    recordAuditEvent({
      eventType: 'EXPORT_OPORTUNIDADES',
      userId: session.user.id ? Number(session.user.id) : null,
      username: session.user.email ?? session.user.name ?? 'desconocido',
      userFullName: session.user.name ?? null,
      metadata: { total, filters: exportFilters, ...(reexportOf && /^\d+$/.test(reexportOf) ? { reexportOf: Number(reexportOf) } : {}) },
      ...clientInfo,
    })
  );

  if (total === 0) {
    return new Response(null, { status: 204 });
  }

  // ── Columnas de la matriz ──────────────────────────────────────────────────
  // Igual que la tabla: solo los Material Codes con facturación > 0 en el resultado
  // (no el catálogo completo). Como el export abarca TODAS las páginas, unimos las
  // columnas de cada bloque (pasada 1) antes de escribir la cabecera; respetamos las
  // columnas que el usuario haya ocultado y ordenamos por descripción (como la tabla).
  const excludeExportCols = getMulti('excludeExportCols');
  const colMap = new Map<string, { materialCode: string; description: string }>();
  const addCols = (cols: { materialCode: string; description: string }[]) => {
    for (const c of cols) {
      if (!colMap.has(c.materialCode)) colMap.set(c.materialCode, { materialCode: c.materialCode, description: c.description });
    }
  };
  addCols(firstPage.materialColumns);
  {
    let res = firstPage;
    let page = 1;
    while (res.rows.length >= opts.pageSize!) {
      page++;
      res = await getOpportunitiesMatrixUncached({ ...opts, page });
      addCols(res.materialColumns);
    }
  }
  let columns = Array.from(colMap.values()).sort((a, b) => a.description.localeCompare(b.description));
  if (excludeExportCols) columns = columns.filter(c => !excludeExportCols.includes(c.materialCode));

  const header = ['Entity Key', 'Cliente', 'Total Facturado',
    ...columns.map(c => `"${c.materialCode} - ${c.description.replace(/"/g, '""')}"`)].join(';');

  const toExcelNum = (num: number) => num.toString().replace('.', ',');

  const stream = new ReadableStream({
    async start(controller) {
      // Escribir BOM UTF-8 y cabecera
      controller.enqueue(new TextEncoder().encode('\uFEFF' + header + '\r\n'));

      let currentResult = firstPage;
      let page = 1;

      // Totales por columna y total general (para la fila de Totales, como el pie de la tabla).
      const colTotals: Record<string, number> = {};
      let grandTotal = 0;

      while (true) {
        if (currentResult.rows.length > 0) {
          const lines = currentResult.rows.map(r => {
            grandTotal += r.total;
            return [
              r.entityKey,
              r.legalName,
              toExcelNum(r.total),
              ...columns.map(c => {
                const amt = r.amounts[c.materialCode] || 0;
                colTotals[c.materialCode] = (colTotals[c.materialCode] || 0) + amt;
                return toExcelNum(amt);
              })
            ].map(csvCell).join(';');
          });

          controller.enqueue(new TextEncoder().encode(lines.join('\r\n') + '\r\n'));
        }

        // El chunk vino incompleto → última página: se exporta TODO el resultado.
        if (currentResult.rows.length < opts.pageSize!) break;

        page++;
        currentResult = await getOpportunitiesMatrixUncached({ ...opts, page });
      }

      // Fila de Totales (igual que el pie de la tabla).
      const tfootRow = [
        'Total',
        '',
        toExcelNum(grandTotal),
        ...columns.map(c => toExcelNum(colTotals[c.materialCode] || 0))
      ].map(csvCell).join(';');

      controller.enqueue(new TextEncoder().encode(tfootRow + '\r\n'));

      controller.close();
    }
  });

  const ts = new Date().toISOString().split('T')[0];
  const fname = `Oportunidades_${ts}.csv`;

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fname}"`,
      'Cache-Control': 'no-store',
      'X-Total-Matched': String(total),
    },
  });
}
