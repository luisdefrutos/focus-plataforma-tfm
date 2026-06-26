/**
 * Seed puntual: alta del usuario administrador 'moure-dev' para evaluación del TFM.
 * Con AUTH_ALLOW_MOCK=true, este usuario puede acceder con cualquier contraseña.
 *
 * Depende de 09-iam-setup. Ejecutar: npm run seed:add-moure
 */

import { prisma } from './lib/prisma'

async function main() {
  console.log('🌱 Añadiendo al evaluador MOURE-DEV como Administrador...')

  const adminRole = await prisma.appRole.findUnique({ where: { roleName: 'ADMINISTRADOR' } })
  if (!adminRole) throw new Error("Rol ADMINISTRADOR no encontrado")

  const user = await prisma.appUser.upsert({
    where: { username: 'moure-dev' },
    update: { fullName: 'Brais Moure (Evaluador)', userType: 'MOCK', isActive: true },
    create: { username: 'moure-dev', fullName: 'Brais Moure (Evaluador)', userType: 'MOCK', isActive: true },
  })

  const allBUs = await prisma.businessUnit.findMany()
  for (const bu of allBUs) {
    await prisma.appUserRole.upsert({
      where: { userId_roleId_buId: { userId: user.userId, roleId: adminRole.roleId, buId: bu.buId } },
      update: {},
      create: { userId: user.userId, roleId: adminRole.roleId, buId: bu.buId },
    })
  }

  console.log('✅ Usuario MOURE-DEV añadido con éxito. Ya puedes probar el login.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
