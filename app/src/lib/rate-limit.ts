/**
 * Rate-limiting en memoria (por proceso) — defensa básica contra abuso de
 * endpoints sensibles sin dependencias externas.
 *
 * Modelo: ventana fija por clave con bloqueo temporal al superar el umbral.
 * Pensado para una herramienta interna de una sola instancia; si en el futuro se
 * despliegan varias réplicas detrás de un balanceador, sustituir el `Map` por un
 * store compartido (Redis) manteniendo la misma interfaz.
 *
 * Server-only: mantiene estado en memoria del servidor.
 */

type Bucket = { count: number; windowEndsAt: number; blockedUntil: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000; // cota anti-fuga de memoria (claves = IP/usuario)

export type RateLimitOptions = {
  /** Nº máximo de eventos permitidos dentro de la ventana antes de bloquear. */
  limit: number;
  /** Duración de la ventana de conteo (ms). */
  windowMs: number;
  /** Duración del bloqueo una vez superado el umbral (ms). */
  blockMs: number;
};

export type RateLimitResult = { ok: boolean; retryAfterMs: number };

function purgeIfNeeded(now: number) {
  if (buckets.size <= MAX_BUCKETS) return;
  for (const [k, b] of buckets) {
    if (b.blockedUntil <= now && b.windowEndsAt <= now) buckets.delete(k);
    if (buckets.size <= MAX_BUCKETS) break;
  }
}

/**
 * Comprueba si una clave está bloqueada SIN contar el evento. Úsalo al principio
 * de la operación para rechazar pronto.
 */
export function checkRateLimit(key: string, now = Date.now()): RateLimitResult {
  const b = buckets.get(key);
  if (b && b.blockedUntil > now) return { ok: false, retryAfterMs: b.blockedUntil - now };
  return { ok: true, retryAfterMs: 0 };
}

/**
 * Registra un evento (p. ej. un intento fallido) y devuelve si la clave queda
 * bloqueada a partir de ahora.
 */
export function recordFailure(key: string, opts: RateLimitOptions, now = Date.now()): RateLimitResult {
  purgeIfNeeded(now);
  let b = buckets.get(key);
  if (!b || b.windowEndsAt <= now) {
    b = { count: 0, windowEndsAt: now + opts.windowMs, blockedUntil: 0 };
    buckets.set(key, b);
  }
  b.count += 1;
  if (b.count >= opts.limit) {
    b.blockedUntil = now + opts.blockMs;
  }
  return b.blockedUntil > now
    ? { ok: false, retryAfterMs: b.blockedUntil - now }
    : { ok: true, retryAfterMs: 0 };
}

/**
 * Registra un evento que SÍ cuenta para el límite (no necesariamente un fallo) y
 * devuelve si se ha superado el umbral. Para endpoints donde cada petición es
 * costosa (exportaciones, agregaciones).
 */
export function consume(key: string, opts: RateLimitOptions, now = Date.now()): RateLimitResult {
  const blocked = checkRateLimit(key, now);
  if (!blocked.ok) return blocked;
  return recordFailure(key, opts, now);
}

/** Limpia el estado de una clave (p. ej. tras un login correcto). */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}
