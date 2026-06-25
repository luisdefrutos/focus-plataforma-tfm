import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad HTTP (defensa en profundidad).
 *
 * - X-Frame-Options / CSP frame-ancestors: anti-clickjacking (la única superficie
 *   con acciones de estado es /accesos). CWE-1021.
 * - X-Content-Type-Options: nosniff.
 * - Referrer-Policy: no filtrar URLs (con filtros/PII) a terceros.
 * - HSTS: fuerza HTTPS (lo ignoran los navegadores sobre http, así que es inocuo en dev).
 *
 * CSP se limita a `frame-ancestors 'none'` a propósito: una política script-src/
 * style-src estricta requiere validar el render de los Web Components del design
 * system (Lit/Shoelace) y los estilos inline; se puede endurecer después con pruebas.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
