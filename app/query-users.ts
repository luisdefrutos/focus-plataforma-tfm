import { prisma } from './src/lib/prisma';

async function main() {
  const users = await prisma.appUser.findMany({
    where: { username: { in: ['defru-li', 'PER-JUA', 'moure-dev'] } },
    select: { username: true, fullName: true, email: true }
  });
  console.log(users);
}

main().catch(console.error).finally(() => prisma.$disconnect());
