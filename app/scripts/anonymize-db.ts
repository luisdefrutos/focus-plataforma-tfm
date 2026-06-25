import { prisma } from '../src/lib/prisma';
import { fakerES as faker } from '@faker-js/faker';

async function main() {
  console.log('Iniciando anonimización con faker...');

  // 1. APP_USERS (Normalmente pocos)
  console.log('Anonimizando APP_USERS...');
  const users = await prisma.appUser.findMany({ select: { userId: true } });
  for (const user of users) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    await prisma.appUser.update({
      where: { userId: user.userId },
      data: {
        fullName: `${firstName} ${lastName}`,
        email: faker.internet.email({ firstName, lastName }),
      }
    });
  }
  
  // 2. ORGANIZATIONS (Pueden ser miles, usamos chunks)
  console.log('Anonimizando ORGANIZATIONS...');
  const orgs = await prisma.organization.findMany({ select: { orgId: true } });
  for (let i = 0; i < orgs.length; i += 500) {
    const chunk = orgs.slice(i, i + 500);
    await prisma.$transaction(
      chunk.map((org, idx) => prisma.organization.update({
        where: { orgId: org.orgId },
        data: {
          legalName: faker.company.name(),
          taxId: 'B' + String(i + idx).padStart(8, '0'),
        }
      }))
    );
    console.log(`  Progreso: ${Math.min(i + 500, orgs.length)} / ${orgs.length}`);
  }

  // 3. CUSTOMER_MASTER (Pueden ser más de 100k, chunks más grandes)
  console.log('Anonimizando CUSTOMER_MASTER...');
  const customers = await prisma.customerMaster.findMany({ select: { customerId: true } });
  for (let i = 0; i < customers.length; i += 500) {
    const chunk = customers.slice(i, i + 500);
    await prisma.$transaction(
      chunk.map((c, idx) => prisma.customerMaster.update({
        where: { customerId: c.customerId },
        data: {
          legalName: faker.company.name(),
          taxId: 'B' + String(i + idx).padStart(8, '0'),
          phone: faker.phone.number(),
        }
      }))
    );
    if ((i + 500) % 10000 === 0) console.log(`  Progreso: ${Math.min(i + 500, customers.length)} / ${customers.length}`);
  }

  // 4. CONTACTS
  console.log('Anonimizando CONTACTS...');
  const contacts = await prisma.contact.findMany({ select: { contactId: true } });
  for (let i = 0; i < contacts.length; i += 500) {
    const chunk = contacts.slice(i, i + 500);
    await prisma.$transaction(
      chunk.map(c => {
        const fn = faker.person.firstName();
        const ln = faker.person.lastName();
        return prisma.contact.update({
          where: { contactId: c.contactId },
          data: {
            firstName: fn,
            lastName: ln,
            fullName: `${fn} ${ln}`,
            email: faker.internet.email({ firstName: fn, lastName: ln }),
            phone: faker.phone.number(),
            mobile: faker.phone.number(),
          }
        });
      })
    );
    if ((i + 500) % 5000 === 0) console.log(`  Progreso: ${Math.min(i + 500, contacts.length)} / ${contacts.length}`);
  }

  // 5. ORGANIZATION_CONTACTS
  console.log('Anonimizando ORGANIZATION_CONTACTS...');
  const orgContacts = await prisma.organizationContact.findMany({ select: { orgContactId: true } });
  for (let i = 0; i < orgContacts.length; i += 500) {
    const chunk = orgContacts.slice(i, i + 500);
    await prisma.$transaction(
      chunk.map(c => {
        const fn = faker.person.firstName();
        const ln = faker.person.lastName();
        return prisma.organizationContact.update({
          where: { orgContactId: c.orgContactId },
          data: {
            firstName: fn,
            lastName: ln,
            fullName: `${fn} ${ln}`,
            email: faker.internet.email({ firstName: fn, lastName: ln }),
            phone: faker.phone.number(),
            mobile: faker.phone.number(),
            fax: faker.phone.number(),
          }
        });
      })
    );
  }

  // 6. BILLING_RECORDS (Usamos SQL directo por ser tablas de cientos de miles de registros y requerir simples matematicas)
  console.log('Anonimizando BILLING_RECORDS (via SQL)...');
  await prisma.$executeRawUnsafe(`
    UPDATE BILLING_RECORDS 
    SET invoice_amount = ROUND(RAND() * 5000 + 10, 2),
        invoice_description = 'Servicio facturado (anonimizado)'
  `);

  // 7. ASSETS & INSPECTIONS & ADDRESSES (Opcionales, pero buena práctica anonimizar)
  console.log('Anonimizando ASSETS y DIRECCIONES (via SQL)...');
  await prisma.$executeRawUnsafe(`
    UPDATE ASSETS
    SET owner_tax_id = CONCAT('B', LPAD(FLOOR(RAND() * 99999999), 8, '0')),
        owner_name = CONCAT('Empresa ', FLOOR(RAND() * 1000)),
        full_address = CONCAT('Calle ', FLOOR(RAND() * 100)),
        postal_code = LPAD(FLOOR(RAND() * 50000), 5, '0')
  `);
  
  await prisma.$executeRawUnsafe(`
    UPDATE ADDRESSES
    SET full_address = CONCAT('Calle ', FLOOR(RAND() * 100)),
        postal_code = LPAD(FLOOR(RAND() * 50000), 5, '0'),
        city = 'Ciudad Anonimizada'
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE INSPECTIONS
    SET maintainer_tax_id = CONCAT('B', LPAD(FLOOR(RAND() * 99999999), 8, '0')),
        maintainer_name = CONCAT('Mantenedor ', FLOOR(RAND() * 1000))
  `);

  console.log('¡Anonimización completada exitosamente!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
