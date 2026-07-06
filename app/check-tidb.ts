import { PrismaClient } from '@prisma/client';

async function main() {
  const url = 'mysql://p2jZbQHxKL82emR.root:WhV1sOZe1M0kZXAQ@gateway01.eu-central-1.prod.aws.tidbcloud.com:4000/test?sslaccept=strict';
  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    const users = await prisma.appUser.findMany({
      select: { username: true, fullName: true, email: true }
    });
    console.log(users);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
