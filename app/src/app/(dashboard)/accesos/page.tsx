import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { recordAuditEvent, clientInfoFromHeaders } from '@/lib/audit';
import { IamAdminPanel } from '@/components/accesos/iam-admin-panel';

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

  // Datos necesarios para el panel (usuarios + catálogo de roles/permisos)
  const [users, roles, permissions] = await Promise.all([
    prisma.appUser.findMany({
      include: {
        userRoles: {
          include: { role: true }
        }
      },
      orderBy: { fullName: 'asc' }
    }),
    prisma.appRole.findMany({
      include: { rolePermissions: true },
      orderBy: { roleName: 'asc' }
    }),
    prisma.appPermission.findMany({
      orderBy: { permissionCode: 'asc' }
    })
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}>Gestión de accesos</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}>
          Administra qué usuarios acceden a Focus y su rol. Todos los usuarios visualizan los mismos datos.
        </p>
      </div>

      <IamAdminPanel
        users={users}
        roles={roles}
        permissions={permissions}
      />
    </div>
  );
}
