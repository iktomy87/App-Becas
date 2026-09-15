const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.padronAcademico.findFirst({ where: { dni: '42732664' } });
  console.log(p);
}

main().finally(() => prisma.$disconnect());

