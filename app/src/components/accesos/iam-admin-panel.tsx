'use client';

import { useState, useTransition } from 'react';
import { TsSelect } from '@tuvsud/design-system/react/select';
import { TsOption } from '@tuvsud/design-system/react/option';
import { TsButton } from '@tuvsud/design-system/react/button';
import { TsIcon } from '@tuvsud/design-system/react/icon';
import { updateAppUserRole, createAppUser, lookupAdUser } from '@/app/(dashboard)/accesos/actions';
import { useRouter } from 'next/navigation';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { PERMISSION_METADATA, type PermissionType } from '@/lib/permissions-metadata';

type AppPermission = {
  permissionId: number;
  permissionCode: string;
  description?: string | null;
};
type AppRole = {
  roleId: number;
  roleName: string;
  description?: string | null;
  rolePermissions?: Array<{ permissionId: number }>;
};
type AppUser = {
  userId: number;
  username: string;
  fullName: string;
  userRoles?: Array<{ roleId?: number | null; role?: { roleName?: string | null } | null }>;
};

type Props = {
  users: AppUser[];
  roles: AppRole[];
  permissions: AppPermission[];
};

export function IamAdminPanel({ users, roles, permissions }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // List Search
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Create User Form
  const [newUsername, setNewUsername] = useState('');
  const [newUserRoleId, setNewUserRoleId] = useState<string>('');
  // Resultado de la verificación contra AD (nombre/email autorrellenados desde el directorio)
  const [adLookup, setAdLookup] = useState<{ username: string; fullName: string; email: string; disabled: boolean } | null>(null);
  const [lookupPending, setLookupPending] = useState(false);
  const [newEmail, setNewEmail] = useState('');

  // Edit Form
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');

  const [successMessage, setSuccessMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  const filteredUsers = users.filter((u: AppUser) =>
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const validRoles = [...roles]
    .sort((a: AppRole, b: AppRole) => (a.rolePermissions?.length || 0) - (b.rolePermissions?.length || 0));

  // Helper: build capabilities summary for a role
  const getRoleCapabilities = (role: AppRole) => {
    const permCodes: string[] = (role.rolePermissions ?? [])
      .map((rp) => permissions.find((pp) => pp.permissionId === rp.permissionId)?.permissionCode)
      .filter((code): code is string => Boolean(code));
    return permCodes.map(code => ({
      code,
      meta: PERMISSION_METADATA[code],
      description: permissions.find((p) => p.permissionCode === code)?.description || ''
    }));
  };

  const typeColors: Record<PermissionType, string> = {
    read: 'bg-green-100 text-green-800',
    write: 'bg-orange-100 text-orange-800',
    admin: 'bg-red-100 text-red-800'
  };
  const typeLabels: Record<PermissionType, string> = {
    read: 'Lectura',
    write: 'Edición',
    admin: 'Admin'
  };

  const handleCreateNewClick = () => {
    setSelectedUser(null);
    setIsCreatingUser(true);
    setSuccessMessage('');
    setError('');
    setNewUsername('');
    setAdLookup(null);
    setNewEmail('');
    if (validRoles.length > 0) setNewUserRoleId(validRoles[0].roleId.toString());
  };

  const handleUserSelect = (user: AppUser) => {
    setSelectedUser(user);
    setIsCreatingUser(false);
    setSuccessMessage('');
    setError('');

    let roleId = user.userRoles?.[0]?.roleId?.toString() || '';
    if (!roleId && validRoles.length > 0) {
      roleId = validRoles[0].roleId.toString();
    }
    setSelectedRoleId(roleId);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    if (!selectedRoleId) {
      setError('Debes seleccionar un rol.');
      return;
    }
    setError('');
    setSuccessMessage('');

    startTransition(async () => {
      const res = await updateAppUserRole(selectedUser.userId, parseInt(selectedRoleId, 10));

      if (res.success) {
        setSuccessMessage('¡Guardado! El usuario debe deslogarse para que los cambios sean aplicados.');
        router.refresh();
      } else {
        setError(res.error || 'Ocurrió un error al guardar');
      }
    });
  };

  const handleVerifyAd = async () => {
    if (!newUsername.trim()) {
      setError('Escribe el nombre de usuario (user_id) a verificar.');
      return;
    }
    setError('');
    setSuccessMessage('');
    setAdLookup(null);
    setLookupPending(true);
    const res = await lookupAdUser(newUsername);
    setLookupPending(false);
    if (res.success) {
      setAdLookup(res.user);
      setNewEmail(res.user.email || '');
    } else {
      setError(res.error || 'No se pudo verificar el usuario en AD.');
    }
  };

  const handleCreateUserSubmit = async () => {
    if (!adLookup) {
      setError('Primero verifica el usuario en el Directorio Activo.');
      return;
    }
    if (!newUserRoleId) {
      setError('Selecciona un perfil.');
      return;
    }
    setError('');
    setSuccessMessage('');

    startTransition(async () => {
      const res = await createAppUser(newUsername, parseInt(newUserRoleId, 10), newEmail.trim() || undefined);
      if (res.success && res.user) {
        setSuccessMessage(res.warning || 'Usuario creado correctamente. Ya puede acceder a Focus.');
        setNewUsername('');
        setAdLookup(null);
        setNewEmail('');
        handleUserSelect({
          ...res.user,
          userRoles: (res.user as AppUser).userRoles ?? [],
        });
      } else {
        setError(res.error || 'Ocurrió un error al crear el usuario');
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 relative">
      <LoadingOverlay isPending={isPending} />

      {/* Columna Izquierda: Lista de Usuarios */}
      <div
        className="col-span-1 rounded-lg border overflow-hidden flex flex-col h-[750px]"
        style={{
          background: 'var(--ts-semantic-color-surface-default)',
          borderColor: 'var(--ts-semantic-color-border-base-default)',
        }}
      >
        <div className="p-4 border-b bg-gray-50 dark:bg-zinc-800 space-y-3" style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold" style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}>Usuarios ({filteredUsers.length})</h2>
            <TsButton size="small" variant="secondary" onClick={handleCreateNewClick}>+ Nuevo</TsButton>
          </div>
          <input
            type="text"
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border rounded-md"
            style={{
              borderColor: 'var(--ts-semantic-color-border-base-default)',
              background: 'var(--ts-semantic-color-surface-default)',
              color: 'var(--ts-semantic-color-text-primary-default)'
            }}
          />
        </div>
        <div className="overflow-y-auto flex-1 p-2 space-y-1">
          {filteredUsers.length === 0 && (
            <div className="text-center p-4 opacity-50 text-sm">No hay resultados</div>
          )}
          {filteredUsers.map((u) => {
            const roleName = u.userRoles?.[0]?.role?.roleName || 'Sin Perfil';
            const isSelected = selectedUser?.userId === u.userId && !isCreatingUser;
            const initials = u.fullName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();

            return (
              <button
                key={u.userId}
                onClick={() => handleUserSelect(u)}
                className={`w-full text-left p-3 rounded-md transition-all flex items-center gap-3 border border-transparent ${
                  isSelected
                    ? 'bg-blue-50 border-blue-200'
                    : 'hover:bg-gray-100'
                }`}
              >
                <div className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                  isSelected ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}>
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate" style={{ color: 'var(--ts-semantic-color-text-primary-default)' }} title={u.fullName}>
                    {u.fullName}
                  </div>
                  <div className="text-xs truncate opacity-70 mb-1" style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }} title={`@${u.username}`}>
                    @{u.username}
                  </div>
                  <div className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                    isSelected ? 'bg-white border-blue-200 text-blue-800' : 'bg-gray-50 border-gray-200 text-gray-600'
                  }`}>
                    {roleName}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Columna Derecha: Formulario */}
      <div
        className="col-span-1 lg:col-span-3 rounded-lg border p-6 flex flex-col h-[750px] overflow-y-auto"
        style={{
          background: 'var(--ts-semantic-color-surface-default)',
          borderColor: 'var(--ts-semantic-color-border-base-default)',
        }}
      >
        {isCreatingUser ? (
          <div className="space-y-6 overflow-y-auto">
            <div>
              <h2 className="text-2xl font-bold">Crear Nuevo Usuario</h2>
              <p className="text-sm opacity-70">
                Introduce el <strong>user_id</strong> de Windows. Comprobaremos que existe en el Directorio
                Activo y traeremos su nombre y email automáticamente.
              </p>
            </div>
            {error && <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>}
            {successMessage && <div className="p-3 rounded-md bg-green-50 text-green-700 text-sm border border-green-200">{successMessage}</div>}

            <div>
              <label className="block text-sm font-medium mb-1">Nombre de Usuario (user_id)</label>
              <div className="flex gap-2">
                <input
                  type="text" className="flex-1 px-3 py-2 border rounded-md"
                  value={newUsername}
                  onChange={(e) => { setNewUsername(e.target.value); setAdLookup(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleVerifyAd(); } }}
                  placeholder="Ej: jperez o DOMINIO\jperez"
                />
                <TsButton variant="secondary" onClick={handleVerifyAd} disabled={lookupPending || !newUsername.trim()}>
                  {lookupPending ? 'Verificando…' : 'Verificar en AD'}
                </TsButton>
              </div>
            </div>

            {adLookup && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <TsIcon name="badge" className="text-blue-600" />
                  <span className="text-sm font-semibold text-blue-900">Encontrado en el Directorio Activo</span>
                  {adLookup.disabled && (
                    <span className="ml-auto px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                      Deshabilitado en AD
                    </span>
                  )}
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-xs opacity-60">Usuario</dt>
                    <dd className="font-medium">{adLookup.username}</dd>
                  </div>
                  <div>
                    <dt className="text-xs opacity-60">Nombre (de AD)</dt>
                    <dd className="font-medium">{adLookup.fullName || '—'}</dd>
                  </div>
                </dl>
                <div>
                  <label className="block text-xs opacity-60 mb-1">
                    Email {adLookup.email ? '(traído de AD, editable)' : '(AD no lo devuelve — introdúcelo a mano)'}
                  </label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="nombre.apellido@tuvsud.com"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold mb-3">Seleccionar Perfil</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {validRoles.map((r) => {
                  const caps = getRoleCapabilities(r);
                  const isSelected = newUserRoleId === r.roleId.toString();
                  return (
                    <button
                      key={r.roleId}
                      type="button"
                      onClick={() => setNewUserRoleId(r.roleId.toString())}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/50 shadow-md ring-1 ring-blue-200'
                          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-blue-500' : 'border-gray-400'
                        }`}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                        </div>
                        <span className="font-bold text-sm">{r.roleName}</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2 ml-6">{r.description || 'Sin descripción'}</p>
                      <div className="ml-6 space-y-1">
                        {caps.map(({ code, meta, description }) => (
                          <div key={code} className="flex items-center gap-1.5">
                            <TsIcon name={meta?.icon || 'key'} className="text-[14px] text-gray-500" />
                            <span className="text-xs text-gray-700">{description}</span>
                            {meta && (
                              <span className={`ml-auto px-1.5 py-0.5 text-[9px] font-bold rounded-full ${typeColors[meta.type]}`}>
                                {typeLabels[meta.type]}
                              </span>
                            )}
                          </div>
                        ))}
                        {caps.length === 0 && (
                          <span className="text-xs text-gray-500 italic">Solo visualización de datos (sin administración)</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <TsButton onClick={handleCreateUserSubmit} disabled={!adLookup || isPending}>Registrar Usuario</TsButton>
          </div>
        ) : !selectedUser ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
            <TsIcon name="settings" style={{ fontSize: '48px' }} />
            <p className="mt-4">Selecciona un usuario o crea uno nuevo.</p>
          </div>
        ) : (
          <div className="flex flex-col h-full space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}>
                  {selectedUser.fullName}
                </h2>
                <p className="text-sm opacity-70">@{selectedUser.username}</p>
              </div>
              <div className="w-64 border rounded-md bg-white">
                <TsSelect value={selectedRoleId} onTsChange={(e: Event) => setSelectedRoleId((e.target as HTMLInputElement).value)}>
                  {validRoles.map((r) => (
                    <TsOption key={r.roleId} value={r.roleId.toString()}>{r.roleName}</TsOption>
                  ))}
                </TsSelect>
              </div>
            </div>

            {/* Role capabilities summary for selected role */}
            {(() => {
              const currentRole = validRoles.find((r) => r.roleId.toString() === selectedRoleId);
              if (!currentRole) return null;
              const caps = getRoleCapabilities(currentRole);
              return (
                <div className="bg-gray-50 border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TsIcon name="info" className="text-blue-500" />
                    <span className="text-sm font-semibold text-gray-700">Perfil: {currentRole.roleName}</span>
                    <span className="text-xs text-gray-500">— {currentRole.description || 'Sin descripción'}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {caps.map(({ code, meta, description }) => (
                      <div key={code} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${
                        meta ? typeColors[meta.type] + ' border-current/20' : 'bg-gray-100 text-gray-700 border-gray-200'
                      }`}>
                        <TsIcon name={meta?.icon || 'key'} className="text-[14px]" />
                        {description}
                      </div>
                    ))}
                    {caps.length === 0 && (
                      <span className="text-xs text-gray-500 italic">Solo visualización de datos (sin administración).</span>
                    )}
                  </div>
                </div>
              );
            })()}

            {successMessage && (
              <div className="p-3 rounded-md bg-green-50 text-green-800 text-sm flex gap-2">
                <TsIcon name="check_circle" className="shrink-0" /> {successMessage}
              </div>
            )}
            {error && (
              <div className="p-3 rounded-md bg-red-50 text-red-800 text-sm flex gap-2">
                <TsIcon name="error" className="shrink-0" /> {error}
              </div>
            )}

            {/* Nota: la visibilidad de datos es global para todos los usuarios */}
            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              <TsIcon name="visibility" className="shrink-0 mt-0.5" />
              <span>
                Todos los usuarios visualizan <strong>los mismos datos</strong> (acceso global). El rol
                solo determina si el usuario puede <strong>administrar los accesos</strong> de Focus.
              </span>
            </div>

            <div className="pt-4 mt-auto border-t flex justify-end" style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}>
              <TsButton variant="primary" onClick={handleSaveUser} loading={isPending} disabled={isPending}>
                Guardar Configuración
              </TsButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
