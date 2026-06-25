/**
 * Export CSV del Buscador 360 — aplica los mismos filtros y el mismo alcance (RLS)
 * que la UI: exige sesión y acota la consulta a las BUs y filtros permitidos del
 * usuario, igual que la página /clientes. Exporta TODO el resultado de la búsqueda
 * (sin tope de filas), en streaming por bloques. Como protección se mantienen el
 * rate-limiting por usuario y el tope de valores por filtro.
 */

import { NextRequest, after } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { searchCustomersUncached, type CustomerSearchOpts } from '@/lib/queries/customers';
import { ENTITY_TYPES } from '@/lib/spain';
import { recordAuditEvent, clientInfoFromRequest } from '@/lib/audit';
import { csvCell } from '@/lib/csv';
import { consume } from '@/lib/rate-limit';

const MAX_FILTER_VALUES = 500; // tope de valores por filtro multi-selección (anti-DoS, CWE-1284)

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  // Mismo alcance que la página: sin sesión no se exporta nada.
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response('No autorizado', { status: 401 });
  }

  // Rate-limiting de exportaciones por usuario (consultas pesadas; CWE-770).
  const rl = consume(`export:clientes:${session.user.id ?? session.user.email ?? 'anon'}`,
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
    pageSize: 5000, // Chunk size para el stream
    buIds: session.user.buIds ?? [],
    allowedFilters: session.user.allowedFilters ?? undefined,
  };

  const entityLabel = new Map(ENTITY_TYPES.map(e => [e.code, e.label] as const));
  const header = [
    'customer_id', 'tax_id', 'sap_customer_code', 'legal_name',
    'entity_type_code', 'entity_type_label', 'intercompany', 'blocked',
    'city', 'province', 'ccaa',
    'invoice_count', 'total_amount', 'years_active', 'bu_count', 'last_invoice_date',
    'incompatibilidad_parcial',
  ].join(';');

  // Primera llamada para obtener el total y el primer chunk de datos
  const firstPage = await searchCustomersUncached(opts);
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
      eventType: 'EXPORT_CLIENTES',
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

  const stream = new ReadableStream({
    async start(controller) {
      // Escribir BOM UTF-8 y cabecera
      controller.enqueue(new TextEncoder().encode('\uFEFF' + header + '\r\n'));

      let currentResult = firstPage;
      let page = 1;

      while (true) {
        if (currentResult.rows.length > 0) {
          const lines = currentResult.rows.map(r => [
            r.customerId, r.taxId, r.sapCustomerCode ?? '', r.legalName,
            r.entityType, entityLabel.get(r.entityType) ?? '',
            r.isIntercompany ? 'SI' : 'NO',
            r.isBlocked ? 'SI' : 'NO',
            r.city ?? '', r.province ?? '', r.ccaa ?? '',
            r.invoiceCount, r.totalAmount, r.yearsActive, r.buCount,
            r.lastInvoiceDate,
            r.hasPartialConflict == null ? '' : r.hasPartialConflict ? 'SI' : 'NO',
          ].map(csvCell).join(';'));

          controller.enqueue(new TextEncoder().encode(lines.join('\r\n') + '\r\n'));
        }

        // El chunk vino incompleto → era la última página: se exporta TODO el resultado.
        if (currentResult.rows.length < opts.pageSize!) {
          break;
        }

        // Pedir el siguiente bloque
        page++;
        currentResult = await searchCustomersUncached({ ...opts, page });
      }

      controller.close();
    }
  });

  const ts = new Date().toISOString().slice(0, 10);
  const fname = `clientes-${ts}.csv`;

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fname}"`,
      'Cache-Control': 'no-store',
      'X-Total-Matched': String(total),
    },
  });
}
