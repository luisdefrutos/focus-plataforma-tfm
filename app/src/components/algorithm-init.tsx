/**
 * Registro one-shot de Google Material Symbols como icon library de Algorithm.
 *
 * Algorithm está construido sobre Web Components (Lit) que tocan `window` en
 * tiempo de carga del módulo — un import top-level rompe SSR con
 * `ReferenceError: window is not defined`. Por eso cargamos el paquete
 * dinámicamente dentro de un `useEffect`, que solo se ejecuta en el navegador.
 *
 * Registramos DOS libraries:
 *   - `material-outlined` (vía registerGoogleMaterial) — uso explícito si hace falta
 *   - `material` (override manual) — TsIcon usa `library="material"` por defecto
 *     (definido en icon.component.js del paquete), así sale outlined sin tener
 *     que poner `library="material-outlined"` en cada `<TsIcon>`.
 *
 * Decisión sobre `basePath`: usamos jsdelivr CDN en lugar de self-host del
 * paquete `@material-symbols/svg-400` (~200 MB de SVGs) porque:
 *   - Evita instalar un paquete pesado solo para los iconos
 *   - Next 16 no sirve `node_modules/` como estáticos por defecto
 *   - El CDN cachea por hash inmutable y es estable
 * Si en prod la política corporativa exige self-hosting, basta con instalar
 * `@material-symbols/svg-400` y cambiar `basePath` a una carpeta de `public/`
 * poblada vía script de build.
 */
'use client';

import { useEffect } from 'react';

const ICON_CDN = 'https://cdn.jsdelivr.net/npm/@material-symbols/svg-400@latest';

export function AlgorithmInit() {
  useEffect(() => {
    // Import dinámico — el paquete solo se carga en cliente, nunca en SSR.
    import('@tuvsud/design-system/react').then(({ registerGoogleMaterial, registerIconLibrary }) => {
      // Library nombrada por si en algún sitio queremos prefijo explícito
      registerGoogleMaterial({
        basePath: ICON_CDN,
        styles: ['outlined'],
      });

      // Override de la library "material" — el default de TsIcon es
      // library="material" (NO "default"), apuntando por defecto a un resolver
      // vacío. La hacemos apuntar a outlined del CDN para que
      // <TsIcon name="search" /> funcione sin prefijos.
      registerIconLibrary('material', {
        resolver: (name: string) => `${ICON_CDN}/outlined/${name}.svg`,
        mutator: (svg: SVGElement) => svg.setAttribute('fill', 'currentColor'),
      });
    });
  }, []);

  return null;
}
