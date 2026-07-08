'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { existeUsuarioLdapAd } from '@/lib/ad-soap';
import { normalizeUsername } from '@/lib/username';
import { recordAuditEvent, clientInfoFromHeaders } from '@/lib/audit';
import type { AllowedFilters } from '@/lib/access';

/**
 * Guarda común de las acciones IAM: exige sesión con permiso IAM_MANAGE, registra
 * los intentos denegados (AUTHZ_DENIED, CWE-778) y revalida contra BD que el actor
 * sigue ACTIVO (el token cachea permisos hasta ~10s; CWE-613). Devuelve la sesión.
 */
async function requireIamManage(action: string) {
  const session = await getServerSession(authOptions);
  const actor = session?.user;
  if (!actor?.permissions?.includes('IAM_MANAGE')) {
    if (actor) {
      await recordAuditEvent({
        eventType: 'AUTHZ_DENIED',
        userId: actor.id ? Number(actor.id) : null,
        username: actor.email ?? actor.name ?? 'desconocido',
        userFullName: actor.name ?? null,
        outcome: 'FAILURE',
        description: `Intento de ${action} sin permiso IAM_MANAGE`,
        targetType: 'IAM_ACTION',
        targetId: action,
        ...(await clientInfoFromHeaders()),
      });
    }
    throw new Error('No tienes permisos para realizar esta acción');
  }
  if (actor.id) {
    const fresh = await prisma.appUser.findUnique({
      where: { userId: Number(actor.id) },
      select: { isActive: true },
    });
    if (!fresh?.isActive) throw new Error('Tu cuenta ya no está activa.');
  }
  return session!;
}

export async function updateAppUserRole(userId: number, roleId: number) {
  const session = await requireIamManage('cambiar el rol de un usuario');

  try {
    const [targetUser, currentRole, newRole] = await Promise.all([
      prisma.appUser.findUnique({ where: { userId }, select: { username: true, fullName: true } }),
      prisma.appUserRole.findFirst({ where: { userId }, include: { role: { select: { roleName: true } } } }),
      roleId ? prisma.appRole.findUnique({ where: { roleId }, select: { roleName: true } }) : Promise.resolve(null),
    ]);

    await prisma.$transaction(async (tx) => {
      await tx.appUserRole.deleteMany({ where: { userId } });

      if (roleId) {
        const allBus = await tx.businessUnit.findMany({ select: { buId: true } });
        if (allBus.length > 0) {
          await tx.appUserRole.createMany({
            data: allBus.map(b => ({ userId, roleId, buId: b.buId })),
          });
        }
      }
    });

    revalidatePath('/accesos');

    await recordAuditEvent({
      eventType: 'USER_ROLE_CHANGED',
      userId: session?.user?.id ? Number(session.user.id) : null,
      username: session?.user?.email ?? session?.user?.name ?? 'desconocido',
      userFullName: session?.user?.name ?? null,
      targetType: 'APP_USER',
      targetId: targetUser?.username ?? String(userId),
      description: `Cambio de rol de ${targetUser?.fullName ?? `usuario #${userId}`}: ${currentRole?.role.roleName ?? '—'} → ${newRole?.roleName ?? '—'}`,
      metadata: { targetUserId: userId, targetUsername: targetUser?.username ?? null, from: currentRole?.role.roleName ?? null, to: newRole?.roleName ?? null },
      ...(await clientInfoFromHeaders()),
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('Error updating user roles:', error);
    return { success: false, error: 'No se pudo actualizar el rol del usuario. Inténtalo de nuevo.' };
  }
}

/**
 * Guarda los filtros granulares (lista blanca por dimensión) de un usuario.
 * allowedFilters = {} → sin restricciones (acceso total en su dimensión).
 */
export async function updateUserFilters(userId: number, allowedFilters: AllowedFilters) {
  const session = await requireIamManage('actualizar filtros de usuario');

  try {
    const targetUser = await prisma.appUser.findUnique({ where: { userId }, select: { username: true, fullName: true } });
    if (!targetUser) return { success: false, error: 'Usuario no encontrado.' };

    await prisma.appUser.update({
      where: { userId },
      data: { allowedFilters: allowedFilters as object },
    });

    revalidatePath('/accesos');

    await recordAuditEvent({
      eventType: 'USER_FILTERS_CHANGED',
      userId: session?.user?.id ? Number(session.user.id) : null,
      username: session?.user?.email ?? session?.user?.name ?? 'desconocido',
      userFullName: session?.user?.name ?? null,
      targetType: 'APP_USER',
      targetId: targetUser.username,
      description: `Filtros granulares actualizados para ${targetUser.fullName}`,
      metadata: { targetUserId: userId, filters: allowedFilters },
      ...(await clientInfoFromHeaders()),
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating user filters:', error);
    return { success: false, error: 'No se pudieron guardar los filtros. Inténtalo de nuevo.' };
  }
}

/**
 * Baja lógica de un usuario (isActive = false).
 * Si el actor se está dando de baja a sí mismo, devuelve selfDeleted: true
 * para que el cliente ejecute signOut().
 */
export async function deactivateAppUser(userId: number) {
  const session = await requireIamManage('dar de baja un usuario');

  try {
    const targetUser = await prisma.appUser.findUnique({
      where: { userId },
      select: { username: true, fullName: true, isActive: true },
    });
    if (!targetUser) return { success: false, error: 'Usuario no encontrado.' };
    if (!targetUser.isActive) return { success: false, error: 'El usuario ya está inactivo.' };

    await prisma.appUser.update({
      where: { userId },
      data: { isActive: false },
    });

    revalidatePath('/accesos');

    await recordAuditEvent({
      eventType: 'USER_DEACTIVATED',
      userId: session?.user?.id ? Number(session.user.id) : null,
      username: session?.user?.email ?? session?.user?.name ?? 'desconocido',
      userFullName: session?.user?.name ?? null,
      targetType: 'APP_USER',
      targetId: targetUser.username,
      description: `Baja lógica de usuario: ${targetUser.fullName} (@${targetUser.username})`,
      metadata: { targetUserId: userId, targetUsername: targetUser.username },
      ...(await clientInfoFromHeaders()),
    });

    const isSelf = session?.user?.id === String(userId);
    return { success: true, selfDeleted: isSelf };
  } catch (error) {
    console.error('Error deactivating user:', error);
    return { success: false, error: 'No se pudo dar de baja al usuario. Inténtalo de nuevo.' };
  }
}

/**
 * Actualiza los permisos MODULE_* de un rol (sin tocar IAM_MANAGE ni otros permisos no-módulo).
 */
export async function updateRoleModules(roleId: number, moduleCodes: string[]) {
  const session = await requireIamManage('actualizar módulos de un rol');

  try {
    const role = await prisma.appRole.findUnique({ where: { roleId }, select: { roleName: true } });
    if (!role) return { success: false, error: 'Rol no encontrado.' };

    // Obtener todos los permisos MODULE_* que existen en BD.
    const modulePerms = await prisma.appPermission.findMany({
      where: { permissionCode: { startsWith: 'MODULE_' } },
      select: { permissionId: true, permissionCode: true },
    });

    // Los permisos no-módulo del rol se conservan (ej. IAM_MANAGE).
    const nonModulePerms = await prisma.appRolePermission.findMany({
      where: {
        roleId,
        permission: { permissionCode: { not: { startsWith: 'MODULE_' } } },
      },
      select: { permissionId: true },
    });

    // IDs de los MODULE_* solicitados.
    const requestedIds = modulePerms
      .filter(p => moduleCodes.includes(p.permissionCode))
      .map(p => p.permissionId);

    await prisma.$transaction(async (tx) => {
      // Borrar solo los permisos MODULE_* del rol.
      const modulePermIds = modulePerms.map(p => p.permissionId);
      await tx.appRolePermission.deleteMany({
        where: { roleId, permissionId: { in: modulePermIds } },
      });
      // Re-insertar los seleccionados.
      if (requestedIds.length > 0) {
        await tx.appRolePermission.createMany({
          data: requestedIds.map(permissionId => ({ roleId, permissionId })),
          skipDuplicates: true,
        });
      }
    });

    revalidatePath('/accesos');

    await recordAuditEvent({
      eventType: 'ROLE_MODULES_CHANGED',
      userId: session?.user?.id ? Number(session.user.id) : null,
      username: session?.user?.email ?? session?.user?.name ?? 'desconocido',
      userFullName: session?.user?.name ?? null,
      targetType: 'APP_ROLE',
      targetId: role.roleName,
      description: `Módulos del rol "${role.roleName}" actualizados: ${moduleCodes.join(', ') || '(ninguno)'}`,
      metadata: { roleId, moduleCodes },
      ...(await clientInfoFromHeaders()),
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating role modules:', error);
    return { success: false, error: 'No se pudieron guardar los módulos. Inténtalo de nuevo.' };
  }
}

/**
 * Verifica un usuario contra Active Directory (sin crearlo).
 */
export async function lookupAdUser(rawUsername: string) {
  await requireIamManage('consultar un usuario en AD');

  const username = normalizeUsername(rawUsername);
  if (!username) return { success: false as const, error: 'Indica un nombre de usuario.' };

  try {
    const mockMode = process.env.AUTH_ALLOW_MOCK === 'true';
    if (mockMode) {
      return {
        success: true as const,
        user: { username, fullName: `Mock ${username}`, email: `${username}@mock.com`, disabled: false },
      };
    }

    const ad = await existeUsuarioLdapAd(username);
    if (ad.errorLdap) return { success: false as const, error: 'El Directorio Activo devolvió un error.' };
    if (!ad.exists) return { success: false as const, error: `El usuario "${username}" no existe en el Directorio Activo.` };
    return {
      success: true as const,
      user: { username: ad.samAccountName || username, fullName: ad.fullName || '', email: ad.email || '', disabled: ad.disabled },
    };
  } catch (err) {
    console.error('Error consultando AD (lookup):', err);
    return { success: false as const, error: 'No se pudo contactar con el Directorio Activo.' };
  }
}

export async function createAppUser(rawUsername: string, roleId: number, emailOverride?: string) {
  const session = await requireIamManage('dar de alta un usuario');

  const username = normalizeUsername(rawUsername);
  if (!username) return { success: false, error: 'Indica un nombre de usuario.' };

  try {
    const existing = await prisma.appUser.findUnique({ where: { username } });
    if (existing) return { success: false, error: 'Ya existe un usuario de Focus con ese identificador.' };

    let ad;
    const mockMode = process.env.AUTH_ALLOW_MOCK === 'true';
    if (mockMode) {
      ad = { exists: true, errorLdap: false, samAccountName: username, fullName: `Mock ${username}`, email: `${username}@mock.com`, disabled: false };
    } else {
      try {
        ad = await existeUsuarioLdapAd(username);
      } catch (err) {
        console.error('Error consultando AD (alta):', err);
        return { success: false, error: 'No se pudo contactar con el Directorio Activo.' };
      }
    }
    if (ad.errorLdap) return { success: false, error: 'El Directorio Activo devolvió un error.' };
    if (!ad.exists) return { success: false, error: `El usuario "${username}" no existe en el Directorio Activo.` };

    const user = await prisma.appUser.create({
      data: {
        username: normalizeUsername(ad.samAccountName || username),
        userType: 'AD',
        fullName: ad.fullName || username,
        email: (emailOverride && emailOverride.trim()) || ad.email || null,
        isActive: true,
      },
    });

    const defaultRole = await prisma.appRole.findUnique({ where: { roleId } });
    const allBus = await prisma.businessUnit.findMany({ select: { buId: true } });
    let userToReturn = user;

    if (defaultRole && allBus.length > 0) {
      await prisma.appUserRole.createMany({
        data: allBus.map(b => ({ userId: user.userId, roleId: defaultRole.roleId, buId: b.buId })),
      });
      const withRoles = await prisma.appUser.findUnique({
        where: { userId: user.userId },
        include: { userRoles: { include: { role: true, bu: { include: { division: true, entity: true } } } } },
      });
      if (withRoles) userToReturn = withRoles;
    }

    await recordAuditEvent({
      eventType: 'USER_CREATED',
      userId: session?.user?.id ? Number(session.user.id) : null,
      username: session?.user?.email ?? session?.user?.name ?? 'desconocido',
      userFullName: session?.user?.name ?? null,
      targetType: 'APP_USER',
      targetId: user.username,
      description: `Alta de usuario ${user.fullName} (@${user.username})${defaultRole ? ` con rol ${defaultRole.roleName}` : ''}`,
      metadata: { targetUserId: user.userId, targetUsername: user.username, roleId, roleName: defaultRole?.roleName ?? null, email: user.email ?? null },
      ...(await clientInfoFromHeaders()),
    });

    revalidatePath('/accesos');
    return {
      success: true,
      user: userToReturn,
      warning: ad.disabled ? 'La cuenta existe en AD pero está deshabilitada; el usuario no podrá iniciar sesión hasta que IT la habilite.' : undefined,
    };
  } catch (error: unknown) {
    console.error('Error creating user:', error);
    if ((error as { code?: string })?.code === 'P2002') return { success: false, error: 'Ya existe un usuario de Focus con ese identificador.' };
    return { success: false, error: 'No se pudo crear el usuario. Inténtalo de nuevo.' };
  }
}
