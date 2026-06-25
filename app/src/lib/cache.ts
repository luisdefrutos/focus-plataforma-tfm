/**
 * Caché de datos de solo lectura (agregaciones que solo cambian al re-seedear).
 *
 * Envuelve funciones de query con `unstable_cache`: las cargas repetidas se sirven
 * de caché (casi instantáneas) durante `TTL_SECONDS`. Todas comparten el tag
 * `billing`, así que tras re-seedear se pueden refrescar al instante con
 * `revalidateTag('billing')` (endpoint POST /api/revalidate).
 */
import { unstable_cache } from 'next/cache';

export const BILLING_TAG = 'billing';
const TTL_SECONDS = 300; // 5 min

/**
 * Envuelve una función async en caché (keyed por keyParts + argumentos).
 *
 * IMPORTANTE (RLS): la clave de caché incluye los keyParts + los ARGUMENTOS de la
 * función. Por eso toda query con alcance por usuario (buIds/allowedFilters) DEBE
 * recibir ese alcance como argumento — así dos usuarios con permisos distintos no
 * comparten la misma entrada. Nunca cachear datos con RLS por una clave que omita
 * el scope del usuario.
 */
export function cached<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  keyParts: string[],
): (...args: A) => Promise<R> {
  return unstable_cache(fn, keyParts, { revalidate: TTL_SECONDS, tags: [BILLING_TAG] });
}
