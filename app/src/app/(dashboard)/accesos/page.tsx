import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { recordAuditEvent, clientInfoFromHeaders } from '@/lib/audit';
import { IamAdminPanel } from '@/components/accesos/iam-admin-panel';
import { ALL_MODULES, MODULE_META } from '@/lib/access';
import { PROVINCES, CCAAS, ENTITY_TYPES, AMOUNT_RANGES } from '@/lib/spain';
import { MATERIALS } from '@/lib/materials';
import { PROFIT_CENTERS } from '@/lib/profit-centers';

export const metadata = { title: 'Gestión de accesos | Focus' };
export const dynamic = 'force-dynamic';

export default async function AccesosPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.permissions?.includes('IAM_MANAGE')) {
    if (session?.user) {
      await recordAuditEvent({
        eventType: 'AUTHZ_DENIED',
        userId: session.user.id ? Number(session.user.id) : null,
        username: session.user.email ?? session.user.name ?? 'desconocido',
        userFullName: session.user.name ?? null,
        outcome: 'FAILURE',
        description: 'Intento de abrir /accesos sin permiso IAM_MANAGE',
        targetType: 'PAGE',
        targetId: '/accesos',
        ...(await clientInfoFromHeaders()),
      });
    }
    redirect('/dashboard');
  }

  const [users, roles, permissions, legalEntities, divisions, cnaeCatalog] = await Promise.all([
    prisma.appUser.findMany({
      include: { userRoles: { include: { role: true } } },
      orderBy: { fullName: 'asc' },
    }),
    prisma.appRole.findMany({
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { roleName: 'asc' },
    }),
    prisma.appPermission.findMany({ orderBy: { permissionCode: 'asc' } }),
    prisma.legalEntity.findMany({
      select: { sapCode: true, legalName: true },
      orderBy: { sapCode: 'asc' },
    }),
    prisma.division.findMany({
      select: { divisionCode: true, divisionName: true },
      orderBy: { divisionCode: 'asc' },
    }),
    prisma.cnaeCatalog.findMany({
      select: { cnaeCode: true, cnaeName: true },
      where: { cnaeCode: { notIn: ['999'] } },
      orderBy: { cnaeCode: 'asc' },
      take: 100,
    }),
  ]);

  const modulesMeta = ALL_MODULES.map(code => ({
    code,
    label: MODULE_META[code].label,
    icon: MODULE_META[code].icon,
  }));

  // Catálogos completos para todos los filtros del buscador
  const catalogs = {
    entities:     legalEntities.map(e => ({ code: e.sapCode, label: `${e.sapCode} — ${e.legalName}` })),
    divisions:    divisions.map(d => ({ code: d.divisionCode, label: `${d.divisionCode} — ${d.divisionName}` })),
    ccaas:        CCAAS.map(c => ({ code: c, label: c })),
    provinces:    PROVINCES.map(p => ({ code: p, label: p })),
    entityTypes:  ENTITY_TYPES.map(e => ({ code: e.code, label: `${e.code} — ${e.label}` })),
    profitCenters: PROFIT_CENTERS.map(p => ({ code: p.code, label: p.name })),
    materials:    MATERIALS.map(m => ({ code: m.code, label: `${m.code} — ${m.name}` })),
    cnaes:        cnaeCatalog.map(c => ({ code: c.cnaeCode, label: `${c.cnaeCode} — ${c.cnaeName}` })),
    amountRanges: AMOUNT_RANGES.map(r => ({ code: r.code, label: r.label })),
    intercompany: [
      { code: '0', label: 'Externo (no intercompany)' },
      { code: '1', label: 'Intercompany (grupo TÜV)' },
    ],
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}>
          Gestión de accesos
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}>
          Administra usuarios, roles, módulos visibles y restricciones de datos.
        </p>
      </div>

      <IamAdminPanel
        users={users as Parameters<typeof IamAdminPanel>[0]['users']}
        roles={roles as Parameters<typeof IamAdminPanel>[0]['roles']}
        permissions={permissions}
        modulesMeta={modulesMeta}
        catalogs={catalogs}
        currentUserId={session.user.id}
      />
    </div>
  );
}
