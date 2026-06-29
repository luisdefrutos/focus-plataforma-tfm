import { prisma } from './lib/prisma'

/**
 * Seed de IAM (Roles, Permisos y Usuarios).
 *
 * Focus es una app de BI de SOLO LECTURA: el modelo de accesos es mínimo.
 *   - 1 permiso: IAM_MANAGE (única capacidad que se comprueba en código).
 *   - 2 roles: ADMINISTRADOR (gestiona accesos) y USUARIO (solo visualiza).
 * El alcance de DATOS NO depende del rol: se controla por BUs (APP_USER_ROLES)
 * + allowedFilters (JSON por usuario).
 */
async function main() {
  console.log('🌱 Iniciando seed de IAM (Roles, Permisos y Usuarios)...')

  // 1. Crear permisos
  const permissions = [
    { permissionCode: 'IAM_MANAGE', description: 'Administración de Accesos de Focus (Usuarios, Roles, BUs)' },
  ]

  console.log('   Insertando permisos...')
  for (const p of permissions) {
    await prisma.appPermission.upsert({
      where: { permissionCode: p.permissionCode },
      update: { description: p.description },
      create: p,
    })
  }

  // 2. Crear roles
  const roles = [
    { roleName: 'ADMINISTRADOR', description: 'Administrador: gestiona accesos y visualiza todos los datos' },
    { roleName: 'USUARIO', description: 'Usuario: visualiza datos acotado por sus BUs y filtros' },
  ]

  console.log('   Insertando roles...')
  for (const r of roles) {
    await prisma.appRole.upsert({
      where: { roleName: r.roleName },
      update: { description: r.description },
      create: r,
    })
  }

  // Obtener IDs para relaciones
  const adminRole = await prisma.appRole.findUnique({ where: { roleName: 'ADMINISTRADOR' } })
  const userRole = await prisma.appRole.findUnique({ where: { roleName: 'USUARIO' } })
  const permIam = await prisma.appPermission.findUnique({ where: { permissionCode: 'IAM_MANAGE' } })

  if (!adminRole || !userRole || !permIam) {
    throw new Error('No se han encontrado los roles o permisos recién insertados')
  }

  // 3. Matriz Rol-Permiso
  console.log('   Asignando permisos a roles...')
  const rolePerms = [
    // ADMINISTRADOR: único rol con acceso a IAM. USUARIO no tiene permisos
    // (su capacidad de visualización no se modela como permiso).
    { roleId: adminRole.roleId, permissionId: permIam.permissionId },
  ]

  for (const rp of rolePerms) {
    await prisma.appRolePermission.upsert({
      where: { roleId_permissionId: { roleId: rp.roleId, permissionId: rp.permissionId } },
      update: {},
      create: rp,
    })
  }

  // 4. Crear usuarios administradores
  console.log('   Insertando usuarios administradores...')
  const users = [
    { username: 'defru-li', userType: 'AD', fullName: 'Administrador (defru-li)', isActive: true },
  ]

  for (const u of users) {
    await prisma.appUser.upsert({
      where: { username: u.username },
      update: { fullName: u.fullName, userType: u.userType, isActive: u.isActive },
      create: u,
    })
  }

  const userDefru = await prisma.appUser.findUnique({ where: { username: 'defru-li' } })

  if (!userDefru) throw new Error('Error recuperando usuarios')

  // Limpiar relaciones antiguas de usuario-rol por si venimos de otra BD
  await prisma.appUserRole.deleteMany({
    where: {
      userId: { in: [userDefru.userId] }
    }
  });

  // 5. Asignar Usuario-Rol-BU: ambos administradores en TODAS las BUs
  console.log('   Asignando administradores a todas las BUs...')
  const allBUs = await prisma.businessUnit.findMany()

  if (allBUs.length === 0) {
    console.log('⚠️ No hay BusinessUnits en la base de datos. Saltando asignación de roles a BU.')
  } else {
    for (const bu of allBUs) {
      await prisma.appUserRole.create({ data: { userId: userDefru.userId, roleId: adminRole.roleId, buId: bu.buId } })
    }
  }

  console.log('✅ Seed IAM completado con éxito.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
