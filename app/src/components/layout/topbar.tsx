/**
 * Topbar superior fija — notificaciones + menú de usuario.
 *
 * Cargado dinámicamente sin SSR desde (dashboard)/layout.tsx — ver nota en
 * sidebar.tsx sobre el patrón con Web Components de Algorithm.
 *
 * El avatar abre un TsDropdown con: acceso a Gestión de Accesos (solo con permiso
 * IAM_MANAGE) y cerrar sesión. Los items usan onClick (evento DOM nativo) en vez
 * del evento de selección del menú para no depender de su nombre (onSl/onTs).
 */
'use client';

import { TsIcon } from '@tuvsud/design-system/react/icon';
import { TsIconButton } from '@tuvsud/design-system/react/icon-button';
import { TsAvatar } from '@tuvsud/design-system/react/avatar';
import { TsDropdown } from '@tuvsud/design-system/react/dropdown';
import { TsMenu } from '@tuvsud/design-system/react/menu';
import { TsMenuItem } from '@tuvsud/design-system/react/menu-item';
import { TsMenuLabel } from '@tuvsud/design-system/react/menu-label';
import { TsDivider } from '@tuvsud/design-system/react/divider';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

/**
 * Siglas para el avatar. Prioriza un nombre real (primeras letras de las dos
 * primeras palabras). Si el nombre es un placeholder de una sola palabra
 * (p. ej. "Administrador (uriza-jo)"), las deriva del usuario AD con la
 * convención apellido-nombre → nombre+apellido ("uriza-jo" → "JU", "PER-JUA" → "JP").
 */
function getUserInitials(name?: string | null, username?: string | null): string {
  const words = (name ?? '')
    .replace(/\([^)]*\)/g, ' ')         // descarta "(uriza-jo)"
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')  // descarta puntuación / guiones
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();

  const parts = (username ?? '').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (parts.length >= 2) return (parts[1][0] + parts[0][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return words[0]?.slice(0, 2).toUpperCase() || '?';
}

export function Topbar({ onMenuClick }: { onMenuClick?: () => void } = {}) {
  const { data: session } = useSession();
  const router = useRouter();
  // Usar el nombre completo (name) que viene de la BD, fallback al username (email)
  const userName = session?.user?.name || session?.user?.email?.toUpperCase() || '';
  const initials = getUserInitials(session?.user?.name, session?.user?.email);
  const canManageIam = session?.user?.permissions?.includes('IAM_MANAGE') ?? false;

  const handleLogout = () => {
    sessionStorage.removeItem('focus-tab-active');
    signOut({ callbackUrl: '/login' });
  };

  return (
    <header
      className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b px-6 bg-background"
    >
      <div className="md:hidden flex items-center">
        <TsIconButton
          name="menu"
          label="Menú"
          onClick={onMenuClick}
        />
      </div>
      <div className="flex-1" />

      {/* Notificaciones */}
      <TsIconButton
        name="notifications"
        label="Notificaciones"
      />

      {/* Avatar usuario con menú desplegable */}
      <div className="flex items-center pl-4 border-l border-border">
        {session ? (
          <TsDropdown placement="bottom-end" distance={8}>
            <button
              slot="trigger"
              aria-label="Menú de usuario"
              className="flex items-center rounded-full transition-opacity hover:opacity-80"
              style={{ cursor: 'pointer', background: 'transparent', border: 'none', padding: 0 }}
            >
              <TsAvatar initials={initials} label={userName} />
            </button>
            <TsMenu>
              <TsMenuLabel>{userName || 'Usuario'}</TsMenuLabel>
              <TsDivider />
              {canManageIam && (
                <TsMenuItem onClick={() => router.push('/accesos')}>
                  <TsIcon slot="prefix" name="settings" />
                  Gestión de accesos
                </TsMenuItem>
              )}
              {canManageIam && (
                <TsMenuItem onClick={() => router.push('/auditoria')}>
                  <TsIcon slot="prefix" name="history" />
                  Registro de actividad
                </TsMenuItem>
              )}
              <TsMenuItem onClick={handleLogout}>
                <TsIcon slot="prefix" name="logout" />
                Cerrar sesión
              </TsMenuItem>
            </TsMenu>
          </TsDropdown>
        ) : (
          <TsAvatar initials="" label="Invitado" />
        )}
      </div>
    </header>
  );
}
