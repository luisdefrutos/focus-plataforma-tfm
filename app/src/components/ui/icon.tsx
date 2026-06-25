/**
 * Wrapper de TsIcon usable desde server components.
 *
 * TsIcon es un Web Component (necesita `'use client'`). Las páginas del
 * dashboard son RSC que hacen queries Prisma directas — no pueden ser
 * `'use client'`. Este componente intermedio resuelve la separación:
 * marca su archivo como `'use client'`, y al ser una boundary, las páginas
 * server pueden importarlo y renderizarlo sin perder su naturaleza server.
 *
 * Props que aceptamos: `name` (icono Material Symbols Outlined, vía CDN
 * configurado en algorithm-init.tsx), `size` (px → CSS var --ts-icon-size),
 * `color` (CSS var o color literal → CSS var --icon-color), y `title` para
 * tooltip nativo.
 */
'use client';

import { TsIcon } from '@tuvsud/design-system/react/icon';

type Props = {
  name: string;
  size?: number;
  /** Cualquier valor CSS — token semántico `var(--ts-…)` o color literal */
  color?: string;
  className?: string;
  title?: string;
};

export function Icon({ name, size, color, className, title }: Props) {
  return (
    <TsIcon
      name={name}
      size={size}
      title={title}
      className={className}
      aria-hidden={title ? undefined : 'true'}
      style={color ? ({ '--icon-color': color } as React.CSSProperties) : undefined}
    />
  );
}
