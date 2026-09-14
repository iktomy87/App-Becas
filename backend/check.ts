import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const conv = await prisma.convocatoria.findFirst();
  if (!conv) {
    console.log("No convocatoria found.");
    return;
  }
  console.log("Convocatoria:", conv.id);
  const cargas = await prisma.cargaPlanilla.findMany();
  console.log("Cargas:", cargas);
  
  const padron = await prisma.padronAcademico.count();
  console.log("Padron count:", padron);
  
  const postulaciones = await prisma.postulacion.count();
  console.log("Postulaciones count:", postulaciones);
}

main().catch(console.error).finally(() => prisma.$disconnect());

