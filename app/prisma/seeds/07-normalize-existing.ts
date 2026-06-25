/**
 * Seed correctivo: aplica las reglas de normalización a los datos que ya están en BD
 * desde seeds anteriores (cuando aún no existía lib/normalize.ts).
 *
 * Cambios:
 *  - addresses.city, province → Title Case
 *  - addresses.postal_code     → 5 dígitos con padding cuando aplique
 *  - customer_master.phone     → formato internacional "+34 NNN NN NN NN"
 *
 * Idempotente: solo actualiza si el valor normalizado difiere del actual.
 */

import { prisma } from './lib/prisma';
import { normalizeCity, normalizePhone, normalizePostalCode } from './lib/normalize';

const BATCH_SIZE = 1000;

async function normalizeAddresses(): Promise<void> {
  console.log('\n🏠 Normalizando addresses (city, province, postal_code)…');
  const total = await prisma.address.count();
  console.log(`   ${total} registros`);

  let processed = 0;
  let updated = 0;
  let lastId = 0;

  while (true) {
    const batch = await prisma.address.findMany({
      where: { addressId: { gt: lastId } },
      orderBy: { addressId: 'asc' },
      take: BATCH_SIZE,
      select: { addressId: true, city: true, province: true, postalCode: true },
    });
    if (batch.length === 0) break;

    for (const a of batch) {
      const newCity = normalizeCity(a.city);
      const newProvince = normalizeCity(a.province);
      const newPostal = normalizePostalCode(a.postalCode);
      const needsUpdate =
        newCity !== a.city || newProvince !== a.province || newPostal !== a.postalCode;
      if (needsUpdate) {
        await prisma.address.update({
          where: { addressId: a.addressId },
          data: { city: newCity, province: newProvince, postalCode: newPostal },
        });
        updated++;
      }
    }
    processed += batch.length;
    lastId = batch[batch.length - 1]!.addressId;
    if (processed % 5000 === 0) process.stdout.write(`   ${processed}/${total} (updated ${updated})\r`);
  }
  console.log(`   ${processed}/${total} ✓  (${updated} actualizadas)`);
}

async function normalizeCustomers(): Promise<void> {
  console.log('\n📞 Normalizando customer_master.phone…');
  const total = await prisma.customerMaster.count({ where: { phone: { not: null } } });
  console.log(`   ${total} con phone no nulo`);

  let processed = 0;
  let updated = 0;
  let lastId = 0;

  while (true) {
    const batch = await prisma.customerMaster.findMany({
      where: { customerId: { gt: lastId }, phone: { not: null } },
      orderBy: { customerId: 'asc' },
      take: BATCH_SIZE,
      select: { customerId: true, phone: true },
    });
    if (batch.length === 0) break;

    for (const c of batch) {
      const newPhone = normalizePhone(c.phone);
      if (newPhone !== c.phone) {
        await prisma.customerMaster.update({
          where: { customerId: c.customerId },
          data: { phone: newPhone },
        });
        updated++;
      }
    }
    processed += batch.length;
    lastId = batch[batch.length - 1]!.customerId;
    if (processed % 5000 === 0) process.stdout.write(`   ${processed}/${total} (updated ${updated})\r`);
  }
  console.log(`   ${processed}/${total} ✓  (${updated} actualizadas)`);
}

export async function seedNormalizeExisting(): Promise<void> {
  console.log('🧹 Seed correctivo: normalización de datos existentes');
  await normalizeAddresses();
  await normalizeCustomers();
  console.log('\n✔ Normalización completa.');
}

if (require.main === module) {
  seedNormalizeExisting()
    .then(() => prisma.$disconnect())
    .catch(err => {
      console.error(err);
      prisma.$disconnect();
      process.exit(1);
    });
}