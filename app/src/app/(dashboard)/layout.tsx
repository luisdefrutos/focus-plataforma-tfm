/**
 * Layout del grupo (dashboard).
 *
 * Marcado 'use client' porque Sidebar y Topbar usan Web Components de Algorithm
 * que tocan `window` al cargar (Lit + customElements.define). Los importamos
 * con `next/dynamic({ ssr: false })` para que solo se carguen en cliente; las
 * páginas hijas (server components que consultan Prisma) siguen renderizándose
 * en server con normalidad — children llegan como props ya pre-renderizadas.
 *
 * El fallback es un skeleton estructural (mismo tamaño que sidebar+topbar) para
 * evitar saltos de layout durante la hidratación.
 */
'use client';

import dynamic from 'next/dynamic';
import { GlobalNavigationLoader } from '@/components/ui/global-navigation-loader';
import { AutoLogout } from '@/components/auth/auto-logout';

const Sidebar = dynamic(
  () => import('@/components/layout/sidebar').then(m => m.Sidebar),
  {
    ssr: false,
    loading: () => (
      <aside
        className="fixed inset-y-0 left-0 z-40 w-60"
        style={{ background: 'var(--ts-semantic-color-background-primary-dark-default)' }}
        aria-hidden="true"
      />
    ),
  },
);

const Topbar = dynamic(
  () => import('@/components/layout/topbar').then(m => m.Topbar),
  {
    ssr: false,
    loading: () => (
      <div
        className="sticky top-0 z-30 h-16 border-b"
        style={{
          background: 'var(--ts-semantic-color-surface-default)',
          borderColor: 'var(--ts-semantic-color-border-base-default)',
        }}
        aria-hidden="true"
      />
    ),
  },
);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--ts-semantic-color-surface-subtle)' }}>
      <AutoLogout />
      <GlobalNavigationLoader />
      <Sidebar />
      <div className="pl-60">
        <Topbar />
        <main className="px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
