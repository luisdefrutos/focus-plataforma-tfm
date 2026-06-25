/**
 * Sidebar fija (240px) con navegación principal.
 *
 * Cargado dinámicamente sin SSR desde (dashboard)/layout.tsx para evitar el
 * `window is not defined` que producen los Web Components de Algorithm al
 * inicializarse. Como TsIcon ya está disponible (pkg cargado), podemos
 * importarlo top-level dentro del componente.
 *
 * Para nav usamos <Link> de Next (no TsMenu) porque la nav está ligada al
 * router de App Router y la integración de TsMenuItem con prefetch / active
 * state requeriría un wrapper que no aporta sobre <Link> + estilos.
 */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TsIcon } from '@tuvsud/design-system/react/icon';
import { cn } from '@/lib/utils';

type NavItem = {
  href: string;
  label: string;
  /** Material Symbol name (https://fonts.google.com/icons) */
  icon: string;
  badge?: string;
  /** Permiso requerido para ver esta ruta. Si está vacío, cualquiera puede verla. */
  requiredPermission?: string;
};

const nav: NavItem[] = [
  { href: '/dashboard',     label: 'Dashboard',      icon: 'dashboard' },
  { href: '/clientes',      label: 'Buscador 360',   icon: 'search' },
  { href: '/oportunidades', label: 'Oportunidades',  icon: 'table_chart' },
  { href: '/top-clientes',  label: 'Top Clientes',   icon: 'star' },
  { href: '/segmentacion',  label: 'Segmentación',   icon: 'pie_chart' },
  { href: '/catalogo',      label: 'Catálogo',       icon: 'list' },
  // 'Gestión de Accesos' (IAM) vive ahora en el menú del avatar (topbar), no aquí.
];

import { useSession } from 'next-auth/react';

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  
  const userPermissions = session?.user?.permissions ?? [];

  const visibleNav = nav.filter(item => {
    if (!item.requiredPermission) return true;
    return userPermissions.includes(item.requiredPermission);
  });

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-sidebar text-sidebar-foreground"
    >
      {/* Brand */}
      <div
        className="flex h-16 items-center gap-3 px-5 border-b"
        style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
      >
        <div
          
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white"
        >
          {/* Logo oficial TÜV LFD */}
          <img src="/tuvsud-logo.svg" alt="TÜV LFD" className="h-9 w-9" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-base font-bold tracking-wide">FOCUS</span>
          <span className="text-[10px] uppercase tracking-widest opacity-70">TÜV LFD España</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {visibleNav.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              
              className={cn(
                'group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active ? 'font-semibold bg-[#005696] text-white' : 'text-white/80 hover:text-white hover:bg-white/5'
              )}
            >
              <TsIcon
                name={item.icon}
                size={20}
                aria-hidden="true"
                // TsIcon usa --ts-semantic-color-text-base-default (oscuro) por
                // defecto; sobre el sidebar oscuro se pierde. Forzamos currentColor
                // para que herede el color del <Link> (claro inactivo, blanco activo).
                style={{ '--icon-color': 'currentColor' } as React.CSSProperties}
              />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span
                  
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-red-600 text-white"
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className="p-3 border-t text-[11px] opacity-60"
        style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
      >
        v0.8 · MVP
      </div>
    </aside>
  );
}
