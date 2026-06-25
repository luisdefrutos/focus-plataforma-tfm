/**
 * Seed puntual: alta de un usuario administrador concreto (uriza-jo) como ADMINISTRADOR
 * en TODAS las BUs. Utilidad de bootstrap local — NO forma parte del pipeline de datos.
 *
 * Depende de 09-iam-setup (rol ADMINISTRADOR y BUs existentes). Ejecutar: npm run seed:add-uriza
 */

import { prisma } from './lib/prisma'

async function main() {
  console.log('🌱 Añadiendo a URIZA-JO como Administrador...')

  const adminRole = await prisma.appRole.findUnique({ where: { roleName: 'ADMINISTRADOR' } })
  if (!adminRole) throw new Error("Rol ADMINISTRADOR no encontrado")

  const user = await prisma.appUser.upsert({
    where: { username: 'uriza-jo' },
    update: { fullName: 'Administrador (uriza-jo)', userType: 'AD', isActive: true },
    create: { username: 'uriza-jo', fullName: 'Administrador (uriza-jo)', userType: 'AD', isActive: true },
  })

  const allBUs = await prisma.businessUnit.findMany()
  for (const bu of allBUs) {
    await prisma.appUserRole.upsert({
      where: { userId_roleId_buId: { userId: user.userId, roleId: adminRole.roleId, buId: bu.buId } },
      update: {},
      create: { userId: user.userId, roleId: adminRole.roleId, buId: bu.buId },
    })
  }

  console.log('✅ Usuario URIZA-JO añadido con éxito.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
