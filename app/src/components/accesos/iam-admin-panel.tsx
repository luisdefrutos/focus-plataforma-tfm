'use client';

/**
 * Panel IAM — gestión completa de usuarios, roles, módulos y filtros del buscador.
 *
 * Tabs:
 *  1. Usuarios — tabla, editar en modal grande, dar de baja
 *  2. Roles y Módulos — checkboxes (TODO MARCADO = sin restricción)
 *  3. Nuevo usuario
 */

import { useState, useTransition, useCallback } from 'react';
import { signOut } from 'next-auth/react';
import {
  updateAppUserRole,
  updateUserFilters,
  deactivateAppUser,
  updateRoleModules,
  createAppUser,
  lookupAdUser,
} from '@/app/(dashboard)/accesos/actions';
import type { AllowedFilters } from '@/lib/access';
import { useRouter } from 'next/navigation';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type CatalogItem = { code: string; label: string };
type Catalogs = {
  entities: CatalogItem[];
  divisions: CatalogItem[];
  ccaas: CatalogItem[];
  provinces: CatalogItem[];
  entityTypes: CatalogItem[];
  profitCenters: CatalogItem[];
  materials: CatalogItem[];
  cnaes: CatalogItem[];
  amountRanges: CatalogItem[];
  intercompany: CatalogItem[];
};

type ModuleMeta = { code: string; label: string; icon: string };

type AppPermission = { permissionId: number; permissionCode: string; description?: string | null };

type AppRole = {
  roleId: number;
  roleName: string;
  description?: string | null;
  rolePermissions?: Array<{ permissionId: number; permission: { permissionCode: string } }>;
};

type AppUser = {
  userId: number;
  username: string;
  fullName: string;
  email?: string | null;
  isActive: boolean;
  allowedFilters?: AllowedFilters | null;
  userRoles?: Array<{ roleId?: number | null; role?: { roleName?: string | null } | null }>;
};

type Props = {
  users: AppUser[];
  roles: AppRole[];
  permissions: AppPermission[];
  modulesMeta: ModuleMeta[];
  catalogs: Catalogs;
  currentUserId: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

/** Un filtro es "efectivamente sin restricción" cuando seleccionó todos los items del catálogo. */
function isAllSelected(selected: string[] | undefined, catalog: CatalogItem[]) {
  if (!selected || selected.length === 0) return true;
  if (selected.length === 1 && selected[0] === '__NONE__') return false;
  return selected.length >= catalog.length;
}

/** Muestra un resumen corto de restricciones activas de un usuario. */
function getActiveRestrictions(filters: AllowedFilters | null | undefined, catalogs: Catalogs) {
  if (!filters) return [];
  const getCount = (sel: string[] | undefined, cat: CatalogItem[]) => {
    if (isAllSelected(sel, cat)) return 0;
    if (sel?.length === 1 && sel[0] === '__NONE__') return 0; // Or return a special marker if you want to show "0 allowed", but the label will say "0 limitados". Better to return -1 or a text, wait, let's just return 0 to hide it, or return a fake count like "0 permitidos".
    // Actually, if it's __NONE__, count is 0, so it says "0 limitados"? No, it should say "0 permitidos". Let's handle it below.
    return sel?.length ?? 0;
  };

  const dims: { label: string; count: number, isNone: boolean }[] = [
    { label: 'provincias', count: getCount(filters.provinces, catalogs.provinces), isNone: filters.provinces?.[0] === '__NONE__' },
    { label: 'materiales', count: getCount(filters.materials, catalogs.materials), isNone: filters.materials?.[0] === '__NONE__' },
    { label: 'CC', count: getCount(filters.profitCenters, catalogs.profitCenters), isNone: filters.profitCenters?.[0] === '__NONE__' },
    { label: 'CCAA', count: getCount(filters.ccaas, catalogs.ccaas), isNone: filters.ccaas?.[0] === '__NONE__' },
    { label: 'divisiones', count: getCount(filters.divisions, catalogs.divisions), isNone: filters.divisions?.[0] === '__NONE__' },
    { label: 'sociedades', count: getCount(filters.entities, catalogs.entities), isNone: filters.entities?.[0] === '__NONE__' },
    { label: 'tipos entidad', count: getCount(filters.entityTypes, catalogs.entityTypes), isNone: filters.entityTypes?.[0] === '__NONE__' },
    { label: 'CNAE', count: getCount(filters.cnaes, catalogs.cnaes), isNone: filters.cnaes?.[0] === '__NONE__' },
    { label: 'rangos €', count: getCount(filters.amountRanges, catalogs.amountRanges), isNone: filters.amountRanges?.[0] === '__NONE__' },
    { label: 'intercompany', count: getCount(filters.intercompany as string[] | undefined, catalogs.intercompany), isNone: (filters.intercompany as string[] | undefined)?.[0] === '__NONE__' },
  ];
  return dims.filter(d => d.count > 0 || d.isNone);
}

// ─── StatusPill ───────────────────────────────────────────────────────────────

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-red-400'}`} />
      {active ? 'Activo' : 'Inactivo'}
    </span>
  );
}

// ─── FilterSection — selector múltiple ───────────────────────────────────────

function FilterSection({
  title, subtitle, items, selected, onChange,
}: {
  title: string;
  subtitle?: string;
  items: CatalogItem[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [q, setQ] = useState('');
  const isAll = selected.length === 0 || selected.length >= items.length;

  const filtered = q.trim()
    ? items.filter(i => i.label.toLowerCase().includes(q.toLowerCase()) || i.code.toLowerCase().includes(q.toLowerCase()))
    : items;

  const toggle = useCallback((code: string) => {
    if (isAll) {
      // Si estaba todo permitido, al desmarcar uno, marcamos todos MENOS ese.
      onChange(items.map(i => i.code).filter(c => c !== code));
      return;
    }
    
    const currentSelected = selected.filter(c => c !== '__NONE__');

    if (currentSelected.includes(code)) {
      const next = currentSelected.filter(c => c !== code);
      // Si al desmarcar quedan cero, usamos el valor especial '__NONE__'
      // para que no se interprete como "todo permitido" (array vacío).
      onChange(next.length === 0 ? ['__NONE__'] : next);
    } else {
      const next = [...currentSelected, code];
      onChange(next.length === items.length ? [] : next);
    }
  }, [selected, items, onChange, isAll]);

  const selectAll = () => { setQ(''); onChange([]); };
  const clearAll = () => { setQ(''); onChange(['__NONE__']); };

  return (
    <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}>
      {/* Header */}
      <div className={`px-4 py-3 flex flex-wrap gap-2 items-start justify-between ${isAll ? 'bg-green-50' : 'bg-amber-50'}`}>
        <div className="flex-1 min-w-[120px]">
          <div className={`text-sm font-semibold ${isAll ? 'text-green-800' : 'text-amber-800'}`}>{title}</div>
          {subtitle && <div className="mt-0.5 text-xs text-gray-500 leading-tight">{subtitle}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isAll ? (
            <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">✓ Permitido (todo)</span>
          ) : selected.length === 1 && selected[0] === '__NONE__' ? (
            <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">Bloqueado (0)</span>
          ) : (
            <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">⚠ {selected.length} limitados</span>
          )}
          {!isAll && (
            <button onClick={selectAll} className="text-xs text-green-600 hover:underline font-semibold ml-1">
              Permitir todo
            </button>
          )}
        </div>
      </div>

      {/* Search + list (always visible) */}
      <div className="p-3 space-y-2 bg-white">
          <input
            type="text" value={q} onChange={e => setQ(e.target.value)}
            placeholder="Buscar..."
            className="w-full text-xs px-3 py-1.5 border rounded-lg"
            style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}
          />
          <div className="max-h-40 overflow-y-auto divide-y border rounded-lg" style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}>
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-400">Sin resultados</div>
            )}
            {filtered.map(item => (
              <label key={item.code} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={isAll || selected.includes(item.code)}
                  onChange={() => toggle(item.code)}
                  className="rounded shrink-0"
                />
                <span className="text-xs">{item.label}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-gray-400">
            <button onClick={selectAll} className="hover:text-gray-600">Marcar todo</button>
            <button onClick={() => onChange(['__NONE__'])} className="hover:text-gray-600">Desmarcar todo</button>
          </div>
        </div>
    </div>
  );
}

// ─── UserEditModal — modal grande centrado ────────────────────────────────────

function UserEditModal({
  user, roles, modulesMeta, catalogs, currentUserId, onClose, onSuccess,
}: {
  user: AppUser;
  roles: AppRole[];
  modulesMeta: ModuleMeta[];
  catalogs: Catalogs;
  currentUserId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<'role' | 'filters' | 'danger'>('role');
  const [selectedRoleId, setSelectedRoleId] = useState(String(user.userRoles?.[0]?.roleId ?? roles[0]?.roleId ?? ''));
  const [filters, setFilters] = useState<AllowedFilters>(() => {
    const f = user.allowedFilters ?? {};
    // Normalizar: si tiene todos los valores del catálogo → tratar como sin restricción (vacío)
    return f;
  });
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const isSelf = currentUserId === String(user.userId);

  // Helper para construir el objeto de filtros limpio (sin arrays que tienen todos los items = sin restricción)
  const buildCleanFilters = (): AllowedFilters => {
    const f = { ...filters };
    const dim = [
      ['entities', catalogs.entities] as const,
      ['divisions', catalogs.divisions] as const,
      ['ccaas', catalogs.ccaas] as const,
      ['provinces', catalogs.provinces] as const,
      ['entityTypes', catalogs.entityTypes] as const,
      ['profitCenters', catalogs.profitCenters] as const,
      ['materials', catalogs.materials] as const,
      ['cnaes', catalogs.cnaes] as const,
      ['amountRanges', catalogs.amountRanges] as const,
    ];
    const out: AllowedFilters = {};
    for (const [key, cat] of dim) {
      const v = f[key as keyof AllowedFilters] as string[] | undefined;
      if (v && v.length > 0 && v.length < cat.length) {
        (out as Record<string, unknown>)[key] = v;
      }
    }
    const ic = f.intercompany;
    if (ic && ic.length === 1) out.intercompany = ic;
    return out;
  };

  const handleSave = () => {
    setMsg(null);
    startTransition(async () => {
      const cleanFilters = buildCleanFilters();
      const [r1, r2] = await Promise.all([
        updateAppUserRole(user.userId, parseInt(selectedRoleId, 10)),
        updateUserFilters(user.userId, cleanFilters),
      ]);
      if (r1.success && r2.success) {
        setMsg({ type: 'ok', text: '✓ Cambios guardados. Si el usuario está conectado, se aplicarán en ~10 segundos.' });
        onSuccess();
      } else {
        setMsg({ type: 'err', text: r1.error ?? r2.error ?? 'Error desconocido.' });
      }
    });
  };

  const handleDeactivate = () => {
    startTransition(async () => {
      const res = await deactivateAppUser(user.userId);
      if (res.success) {
        if (res.selfDeleted) { await signOut({ callbackUrl: '/login' }); return; }
        onSuccess(); onClose();
      } else {
        setMsg({ type: 'err', text: res.error ?? 'No se pudo dar de baja.' });
      }
    });
  };

  const setDim = useCallback((key: keyof AllowedFilters, val: string[]) => {
    setFilters(prev => ({ ...prev, [key]: val.length > 0 ? val : undefined }));
  }, []);

  const restrictions = getActiveRestrictions(filters, catalogs);

  const filterTabs = [
    { id: 'role' as const, label: 'Rol', icon: '🎭' },
    { id: 'filters' as const, label: `Filtros${restrictions.length > 0 ? ` (${restrictions.length})` : ''}`, icon: '🔒' },
    { id: 'danger' as const, label: 'Baja', icon: '⚠️' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-5 border-b" style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}>
          <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-lg font-bold shrink-0">
            {initials(user.fullName)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold truncate" style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}>
              {user.fullName}
              {isSelf && <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-normal">Tú</span>}
            </h2>
            <p className="text-sm text-gray-500">@{user.username}{user.email ? ` · ${user.email}` : ''}</p>
          </div>
          <StatusPill active={user.isActive} />
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 text-xl leading-none">×</button>
        </div>

        {/* Inner tabs */}
        <div className="flex border-b px-6" style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}>
          {filterTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {msg && (
            <div className={`mb-4 p-3 rounded-lg text-sm flex gap-2 ${msg.type === 'ok' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {msg.text}
            </div>
          )}

          {/* Tab: Rol */}
          {tab === 'role' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Selecciona el rol del usuario. El rol define qué módulos y permisos tiene por defecto.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {roles.map(r => {
                  const isSelected = selectedRoleId === String(r.roleId);
                  const perms = (r.rolePermissions ?? []).map(rp => rp.permission.permissionCode);
                  const isSuper = perms.includes('IAM_MANAGE');
                  return (
                    <button
                      key={r.roleId}
                      type="button"
                      onClick={() => setSelectedRoleId(String(r.roleId))}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${isSelected ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-blue-500' : 'border-gray-300'}`}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                        </div>
                        <span className="font-bold text-sm">{r.roleName}</span>
                        {isSuper && <span className="ml-auto text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">Superusuario</span>}
                      </div>
                      {r.description && <p className="text-xs text-gray-500 ml-6">{r.description}</p>}
                      <div className="ml-6 mt-2 text-xs text-gray-400">
                        {isSuper ? '✓ Acceso total a todos los módulos y administración' : `${perms.filter(p => p.startsWith('MODULE_')).length || 'Todos los'} módulos`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab: Filtros */}
          {tab === 'filters' && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
                <strong>Permitido (todo) = el usuario ve todos los datos.</strong> Si desmarcas alguna opción, el usuario solo tendrá acceso a los datos que dejes marcados en estas listas.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FilterSection
                  title="Sociedad TÜV"
                  subtitle="Ej: 0135, 0136"
                  items={catalogs.entities}
                  selected={filters.entities ?? []}
                  onChange={v => setDim('entities', v)}
                />
                <FilterSection
                  title="División"
                  subtitle="II, MO, NGB..."
                  items={catalogs.divisions}
                  selected={filters.divisions ?? []}
                  onChange={v => setDim('divisions', v)}
                />
                <FilterSection
                  title="CCAA"
                  items={catalogs.ccaas}
                  selected={filters.ccaas ?? []}
                  onChange={v => setDim('ccaas', v)}
                />
                <FilterSection
                  title="Provincia"
                  items={catalogs.provinces}
                  selected={filters.provinces ?? []}
                  onChange={v => setDim('provinces', v)}
                />
                <FilterSection
                  title="Tipo de entidad"
                  subtitle="Letra CIF/NIF"
                  items={catalogs.entityTypes}
                  selected={filters.entityTypes ?? []}
                  onChange={v => setDim('entityTypes', v)}
                />
                <FilterSection
                  title="Centro de coste"
                  items={catalogs.profitCenters}
                  selected={filters.profitCenters ?? []}
                  onChange={v => setDim('profitCenters', v)}
                />
                <FilterSection
                  title="Material / Servicio"
                  subtitle="Material code"
                  items={catalogs.materials}
                  selected={filters.materials ?? []}
                  onChange={v => setDim('materials', v)}
                />
                <FilterSection
                  title="CNAE"
                  subtitle="Sector de actividad"
                  items={catalogs.cnaes}
                  selected={filters.cnaes ?? []}
                  onChange={v => setDim('cnaes', v)}
                />
                <FilterSection
                  title="Rango de facturación"
                  items={catalogs.amountRanges}
                  selected={filters.amountRanges ?? []}
                  onChange={v => setDim('amountRanges', v)}
                />
                <FilterSection
                  title="Intercompany"
                  items={catalogs.intercompany}
                  selected={filters.intercompany ?? []}
                  onChange={v => setDim('intercompany', v as ('0' | '1')[])}
                />
              </div>
            </div>
          )}

          {/* Tab: Baja */}
          {tab === 'danger' && (
            <div className="space-y-4">
              {!showDeactivateConfirm ? (
                <>
                  <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                    <h3 className="font-semibold text-sm mb-1">Desactivar usuario</h3>
                    <p className="text-xs text-gray-600">
                      El usuario perderá inmediatamente el acceso a la plataforma. 
                      Su historial y actividad se conservan por motivos de seguridad.
                    </p>
                  </div>
                  {isSelf && (
                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-800">
                      ⚠️ Estás a punto de darte de baja a ti mismo. <strong>Se cerrará la sesión inmediatamente.</strong>
                    </div>
                  )}
                  <button
                    onClick={() => setShowDeactivateConfirm(true)}
                    disabled={!user.isActive}
                    className="px-4 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 disabled:opacity-40 transition-colors"
                  >
                    {user.isActive ? 'Dar de baja a este usuario' : 'Usuario ya inactivo'}
                  </button>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border-2 border-red-400 bg-red-50">
                    <p className="font-bold text-red-800">¿Confirmar baja de <em>{user.fullName}</em>?</p>
                    {isSelf && <p className="mt-1 text-sm text-red-700">Se cerrará tu sesión inmediatamente tras confirmar.</p>}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowDeactivateConfirm(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">
                      Cancelar
                    </button>
                    <button
                      onClick={handleDeactivate}
                      disabled={isPending}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 disabled:opacity-60"
                    >
                      {isPending ? 'Procesando…' : 'Sí, dar de baja'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer sticky */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-end gap-3" style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-white">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isPending || tab === 'danger'}
            className="px-6 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 font-semibold"
          >
            {isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── RolesTab ─────────────────────────────────────────────────────────────────

function RolesTab({ roles, modulesMeta }: { roles: AppRole[]; modulesMeta: ModuleMeta[] }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ roleId: number; type: 'ok' | 'err'; text: string } | null>(null);

  // Inicializar: si un rol no tiene MODULE_* → TODOS marcados (sin restricción = acceso total)
  const [roleModules, setRoleModules] = useState<Record<number, string[]>>(() => {
    const init: Record<number, string[]> = {};
    for (const r of roles) {
      const mods = (r.rolePermissions ?? [])
        .map(rp => rp.permission.permissionCode)
        .filter(c => c.startsWith('MODULE_'));
      // Sin módulos en BD → todos marcados (sin restricción)
      init[r.roleId] = mods.length > 0 ? mods : modulesMeta.map(m => m.code);
    }
    return init;
  });

  const hasIam = (r: AppRole) =>
    (r.rolePermissions ?? []).some(rp => rp.permission.permissionCode === 'IAM_MANAGE');

  const toggleModule = (roleId: number, code: string) => {
    setRoleModules(prev => {
      const current = prev[roleId] ?? [];
      return { ...prev, [roleId]: current.includes(code) ? current.filter(c => c !== code) : [...current, code] };
    });
  };

  const selectAll = (roleId: number) => {
    setRoleModules(prev => ({ ...prev, [roleId]: modulesMeta.map(m => m.code) }));
  };

  const handleSave = (roleId: number) => {
    const allSelected = roleModules[roleId]?.length >= modulesMeta.length;
    // Si están todos seleccionados → guardar lista vacía (= sin restricción)
    const toSave = allSelected ? [] : (roleModules[roleId] ?? []);
    setMsg(null);
    startTransition(async () => {
      const res = await updateRoleModules(roleId, toSave);
      setMsg({ roleId, type: res.success ? 'ok' : 'err', text: res.success ? 'Módulos guardados.' : (res.error ?? 'Error.') });
    });
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800">
        <p className="font-semibold">Acceso a pantallas</p>
        <p className="mt-1 text-xs">
          Las casillas marcadas indican qué pantallas puede ver cada rol en el menú principal. 
          Desmarca las pantallas que quieras ocultar.
        </p>
      </div>

      {roles.map(r => {
        const isSuper = hasIam(r);
        const mods = roleModules[r.roleId] ?? modulesMeta.map(m => m.code);
        const allChecked = mods.length >= modulesMeta.length;
        const roleMsg = msg?.roleId === r.roleId ? msg : null;

        return (
          <div key={r.roleId} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50" style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{isSuper ? '🛡️' : '👤'}</span>
                <div>
                  <span className="font-bold text-sm">{r.roleName}</span>
                  {isSuper && <span className="ml-2 text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full">Superusuario</span>}
                  {allChecked && <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Sin restricción</span>}
                  {!allChecked && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{mods.length} de {modulesMeta.length} módulos</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!allChecked && (
                  <button onClick={() => selectAll(r.roleId)} className="text-xs text-blue-600 hover:underline">Marcar todo</button>
                )}
                <button
                  onClick={() => handleSave(r.roleId)}
                  disabled={isPending}
                  className="px-4 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 font-semibold"
                >
                  Guardar
                </button>
              </div>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {modulesMeta.map(m => {
                  const active = mods.includes(m.code);
                  return (
                    <label key={m.code} className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${active ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleModule(r.roleId, m.code)}
                        className="rounded accent-blue-600"
                      />
                      <span className={`text-xs font-medium ${active ? 'text-blue-800' : 'text-gray-500'}`}>{m.label}</span>
                    </label>
                  );
                })}
              </div>

              {roleMsg && (
                <div className={`mt-3 text-xs px-3 py-2 rounded-lg flex gap-1.5 ${roleMsg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {roleMsg.text}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── CreateUserForm ───────────────────────────────────────────────────────────

function CreateUserForm({ roles, onSuccess }: { roles: AppRole[]; onSuccess: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [newUsername, setNewUsername] = useState('');
  const [newUserRoleId, setNewUserRoleId] = useState(String(roles[0]?.roleId ?? ''));
  const [adLookup, setAdLookup] = useState<{ username: string; fullName: string; email: string; disabled: boolean } | null>(null);
  const [lookupPending, setLookupPending] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleVerify = async () => {
    if (!newUsername.trim()) return;
    setMsg(null); setAdLookup(null); setLookupPending(true);
    const res = await lookupAdUser(newUsername);
    setLookupPending(false);
    if (res.success) { setAdLookup(res.user); setNewEmail(res.user.email || ''); }
    else setMsg({ type: 'err', text: res.error ?? 'Error en AD.' });
  };

  const handleCreate = () => {
    if (!adLookup || !newUserRoleId) return;
    setMsg(null);
    startTransition(async () => {
      const res = await createAppUser(newUsername, parseInt(newUserRoleId, 10), newEmail.trim() || undefined);
      if (res.success) {
        setMsg({ type: 'ok', text: res.warning ?? 'Usuario creado correctamente. Ya puede acceder a Focus.' });
        setNewUsername(''); setAdLookup(null); setNewEmail('');
        onSuccess();
      } else {
        setMsg({ type: 'err', text: res.error ?? 'Error al crear.' });
      }
    });
  };

  return (
    <div className="max-w-lg space-y-5">
      <div>
        <h3 className="text-base font-bold mb-1">Crear nuevo usuario</h3>
        <p className="text-xs text-gray-500">Introduce el user_id de Windows y verificaremos contra Active Directory.</p>
      </div>
      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.type === 'ok' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {msg.text}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text" value={newUsername}
          onChange={e => { setNewUsername(e.target.value); setAdLookup(null); }}
          onKeyDown={e => e.key === 'Enter' && handleVerify()}
          placeholder="Ej: jperez o DOMINIO\\jperez"
          className="flex-1 px-3 py-2 text-sm border rounded-lg"
          style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}
        />
        <button
          onClick={handleVerify} disabled={lookupPending || !newUsername.trim()}
          className="px-4 py-2 text-sm rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-50 font-medium"
        >
          {lookupPending ? 'Verificando…' : 'Verificar AD'}
        </button>
      </div>

      {adLookup && (
        <>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-blue-600">🪪</span>
              <span className="text-sm font-semibold text-blue-900">Encontrado en Active Directory</span>
              {adLookup.disabled && <span className="ml-auto text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">Deshabilitado en AD</span>}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-xs text-gray-400">Usuario</span><div className="font-medium">{adLookup.username}</div></div>
              <div><span className="text-xs text-gray-400">Nombre</span><div className="font-medium">{adLookup.fullName || '—'}</div></div>
            </div>
            <div>
              <label className="text-xs text-gray-400">Email</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                className="mt-1 w-full px-3 py-1.5 text-sm border rounded-lg"
                style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}
                placeholder="nombre.apellido@tuvsud.com" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Rol inicial</label>
            <div className="grid grid-cols-2 gap-2">
              {roles.map(r => (
                <button key={r.roleId} type="button" onClick={() => setNewUserRoleId(String(r.roleId))}
                  className={`text-left p-3 rounded-xl border-2 transition-all ${newUserRoleId === String(r.roleId) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="text-sm font-semibold">{r.roleName}</div>
                  {r.description && <div className="text-xs text-gray-400 mt-0.5">{r.description}</div>}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleCreate} disabled={isPending}
            className="w-full py-2.5 text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 font-semibold"
          >
            {isPending ? 'Creando…' : 'Registrar usuario'}
          </button>
        </>
      )}
    </div>
  );
}

// ─── Panel principal ──────────────────────────────────────────────────────────

export function IamAdminPanel({ users, roles, permissions, modulesMeta, catalogs, currentUserId }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<'users' | 'roles' | 'create'>('users');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);

  const filtered = users.filter(u => {
    const matchSearch = u.fullName.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase());
    const matchActive = showInactive ? true : u.isActive;
    return matchSearch && matchActive;
  });

  return (
    <div className="space-y-4">
      {/* Tabs principales */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}>
        {[
          { id: 'users' as const, label: `Usuarios (${users.filter(u => u.isActive).length})`, icon: '👥' },
          { id: 'roles' as const, label: 'Roles y Módulos', icon: '🛡️' },
          { id: 'create' as const, label: '+ Nuevo usuario', icon: '' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.icon && <span>{t.icon}</span>}
            {t.label}
          </button>
        ))}
      </div>

      {/* Usuarios */}
      {tab === 'users' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre o usuario..."
              className="flex-1 min-w-48 px-3 py-2 text-sm border rounded-lg"
              style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}
            />
            <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
              <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded" />
              Mostrar inactivos
            </label>
            <span className="text-xs text-gray-400">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}>
                  <th className="px-5 py-3 text-left">Usuario</th>
                  <th className="px-5 py-3 text-left">Rol</th>
                  <th className="px-5 py-3 text-left">Restricciones activas</th>
                  <th className="px-5 py-3 text-left">Estado</th>
                  <th className="px-5 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}>
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400">Sin resultados</td></tr>
                )}
                {filtered.map(u => {
                  const roleName = u.userRoles?.[0]?.role?.roleName ?? 'Sin rol';
                  const restrictions = getActiveRestrictions(u.allowedFilters, catalogs);
                  const isSelf = currentUserId === String(u.userId);

                  return (
                    <tr key={u.userId} className={`hover:bg-gray-50 transition-colors ${!u.isActive ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                            {initials(u.fullName)}
                          </div>
                          <div>
                            <div className="font-semibold">
                              {u.fullName}
                              {isSelf && <span className="ml-1.5 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Tú</span>}
                            </div>
                            <div className="text-xs text-gray-400">@{u.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold">{roleName}</span>
                      </td>
                      <td className="px-5 py-4">
                        {restrictions.length === 0 ? (
                          <span className="text-xs text-green-600 font-medium">✓ Sin restricciones</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {restrictions.map(r => (
                              <span key={r.label} className={`px-2 py-0.5 border rounded text-[11px] font-medium ${r.isNone ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                {r.isNone ? '0 permitidos' : `${r.count} limitados`} ({r.label})
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4"><StatusPill active={u.isActive} /></td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => setEditUser(u)}
                          className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-100 font-medium inline-flex items-center gap-1.5"
                        >
                          ✏️ Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'roles' && (
        <RolesTab roles={roles} modulesMeta={modulesMeta} />
      )}

      {tab === 'create' && (
        <CreateUserForm roles={roles} onSuccess={() => { router.refresh(); setTab('users'); }} />
      )}

      {/* Modal de edición */}
      {editUser && (
        <UserEditModal
          user={editUser}
          roles={roles}
          modulesMeta={modulesMeta}
          catalogs={catalogs}
          currentUserId={currentUserId}
          onClose={() => setEditUser(null)}
          onSuccess={() => { router.refresh(); }}
        />
      )}
    </div>
  );
}
