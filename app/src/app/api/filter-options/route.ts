/**
 * Opciones de filtros pesados del Buscador 360 (materiales ~492, centros de coste ~206),
 * cargadas de forma PEREZOSA por el combobox al abrirlo — antes viajaban en el payload
 * RSC de cada carga de página, se usaran o no.
 *
 * Reutiliza `getFilterCatalogs`, así que aplica EXACTAMENTE el mismo alcance RLS
 * (allowedFilters whitelisteados por usuario) y comparte su caché — sin duplicar lógica.
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getFilterCatalogs } from '@/lib/queries/customers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  // Mismo alcance que la página: sin sesión no se devuelve nada.
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response('No autorizado', { status: 401 });
  }

  const type = new URL(req.url).searchParams.get('type');
  if (type !== 'materials' && type !== 'profitCenters') {
    return new Response('Parámetro "type" inválido (materials | profitCenters)', { status: 400 });
  }

  const buIds = session.user.buIds ?? [];
  const allowedFilters = session.user.allowedFilters ?? undefined;
  const catalogs = await getFilterCatalogs(buIds, allowedFilters);
  const data = type === 'materials' ? catalogs.materials : catalogs.profitCenters;

  // Cambian solo al re-seedear; el alcance es por usuario → caché privada de 5 min.
  return Response.json(data, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  });
}
