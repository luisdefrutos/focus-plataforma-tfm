'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { existeUsuarioLdapAd } from '@/lib/ad-soap';
import { normalizeUsername } from '@/lib/username';
import { recordAuditEvent, clientInfoFromHeaders } from '@/lib/audit';

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
    // Datos para la auditoría (capturados ANTES de modificar): usuario objetivo + rol actual.
    const [targetUser, currentRole, newRole] = await Promise.all([
      prisma.appUser.findUnique({ where: { userId }, select: { username: true, fullName: true } }),
      prisma.appUserRole.findFirst({ where: { userId }, include: { role: { select: { roleName: true } } } }),
      roleId ? prisma.appRole.findUnique({ where: { roleId }, select: { roleName: true } }) : Promise.resolve(null),
    ]);

    await prisma.$transaction(async (tx) => {
      // Reemplazar el rol del usuario. El alcance de datos es global para todos
      // (ver loadUserScope en auth.ts), así que el rol se asigna en todas las BUs.
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
      description: `Cambio de rol de ${targetUser?.fullName ?? targetUser?.username ?? `usuario #${userId}`}: ${currentRole?.role.roleName ?? '—'} → ${newRole?.roleName ?? '—'}`,
      metadata: {
        targetUserId: userId,
        targetUsername: targetUser?.username ?? null,
        from: currentRole?.role.roleName ?? null,
        to: newRole?.roleName ?? null,
      },
      ...(await clientInfoFromHeaders()),
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('Error updating user roles:', error);
    return { success: false, error: 'No se pudo actualizar el rol del usuario. Inténtalo de nuevo.' };
  }
}

/**
 * Verifica un usuario contra Active Directory (sin crearlo) y devuelve sus datos
 * para previsualizarlos en el formulario de alta (nombre + email). No valida
 * contraseña — solo existencia.
 */
export async function lookupAdUser(rawUsername: string) {
  await requireIamManage('consultar un usuario en AD');

  const username = normalizeUsername(rawUsername);
  if (!username) return { success: false as const, error: 'Indica un nombre de usuario.' };

  try {
    const ad = await existeUsuarioLdapAd(username);
    if (ad.errorLdap) {
      return { success: false as const, error: 'El Directorio Activo devolvió un error consultando ese usuario.' };
    }
    if (!ad.exists) {
      return { success: false as const, error: `El usuario "${username}" no existe en el Directorio Activo.` };
    }
    return {
      success: true as const,
      user: {
        username: ad.samAccountName || username,
        fullName: ad.fullName || '',
        email: ad.email || '',
        disabled: ad.disabled,
      },
    };
  } catch (err) {
    console.error('Error consultando AD (lookup):', err);
    return { success: false as const, error: 'No se pudo contactar con el Directorio Activo. Inténtalo de nuevo.' };
  }
}

export async function createAppUser(rawUsername: string, roleId: number, emailOverride?: string) {
  const session = await requireIamManage('dar de alta un usuario');

  const username = normalizeUsername(rawUsername);
  if (!username) {
    return { success: false, error: 'Indica un nombre de usuario.' };
  }

  try {
    const existing = await prisma.appUser.findUnique({ where: { username } });
    if (existing) {
      return { success: false, error: 'Ya existe un usuario de Focus con ese identificador.' };
    }

    // Verificación autoritativa contra AD: el nombre y el email salen del directorio,
    // no de lo que teclee el cliente.
    let ad;
    try {
      ad = await existeUsuarioLdapAd(username);
    } catch (err) {
      console.error('Error consultando AD (alta):', err);
      return { success: false, error: 'No se pudo contactar con el Directorio Activo. Inténtalo de nuevo.' };
    }
    if (ad.errorLdap) {
      return { success: false, error: 'El Directorio Activo devolvió un error consultando ese usuario.' };
    }
    if (!ad.exists) {
      return { success: false, error: `El usuario "${username}" no existe en el Directorio Activo.` };
    }

    const user = await prisma.appUser.create({
      data: {
        // Se guarda normalizado (minúsculas) para que el alta y el login usen la
        // MISMA clave y no dependan de la collation de MySQL (CWE-178).
        username: normalizeUsername(ad.samAccountName || username),
        userType: 'AD',
        fullName: ad.fullName || username,
        // El nombre es autoritativo de AD; el email se toma del formulario si se
        // indica (AD no siempre devuelve `mail`), con el de AD como respaldo.
        email: (emailOverride && emailOverride.trim()) || ad.email || null,
        isActive: true,
      }
    });

    // Asignar Rol seleccionado en todas las BUs (alcance global para todos).
    const defaultRole = await prisma.appRole.findUnique({ where: { roleId } });
    const allBus = await prisma.businessUnit.findMany({ select: { buId: true } });

    let userToReturn = user;

    if (defaultRole && allBus.length > 0) {
      await prisma.appUserRole.createMany({
        data: allBus.map(b => ({ userId: user.userId, roleId: defaultRole.roleId, buId: b.buId })),
      });

      const userWithRoles = await prisma.appUser.findUnique({
        where: { userId: user.userId },
        include: {
          userRoles: {
            include: { role: true, bu: { include: { division: true, entity: true } } }
          }
        }
      });
      
      if (userWithRoles) {
        userToReturn = userWithRoles;
      }
    }

    await recordAuditEvent({
      eventType: 'USER_CREATED',
      userId: session?.user?.id ? Number(session.user.id) : null,
      username: session?.user?.email ?? session?.user?.name ?? 'desconocido',
      userFullName: session?.user?.name ?? null,
      targetType: 'APP_USER',
      targetId: user.username,
      description: `Alta de usuario ${user.fullName} (@${user.username})${defaultRole ? ` con rol ${defaultRole.roleName}` : ''}`,
      metadata: {
        targetUserId: user.userId,
        targetUsername: user.username,
        roleId,
        roleName: defaultRole?.roleName ?? null,
        email: user.email ?? null,
      },
      ...(await clientInfoFromHeaders()),
    });

    revalidatePath('/accesos');
    return {
      success: true,
      user: userToReturn,
      warning: ad.disabled
        ? 'La cuenta existe en AD pero está deshabilitada; el usuario no podrá iniciar sesión hasta que IT la habilite.'
        : undefined,
    };
  } catch (error: unknown) {
    console.error('Error creating user:', error);
    // Carrera (dos altas simultáneas) → la constraint única dispara P2002.
    if ((error as { code?: string })?.code === 'P2002') {
      return { success: false, error: 'Ya existe un usuario de Focus con ese identificador.' };
    }
    return { success: false, error: 'No se pudo crear el usuario. Inténtalo de nuevo.' };
  }
}
