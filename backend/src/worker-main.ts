// src/worker-main.ts
//
// Proceso separado del API. NO levanta un servidor HTTP — solo se conecta
// a Redis y procesa jobs de la cola `importacion`. Se ejecuta como un
// comando/proceso distinto (ver package.json y Dockerfile más abajo).
//
// Por qué separarlo: el parseo de un Excel de 2GB es trabajo de CPU que,
// aunque esté dentro de un job async, puede competir por el event loop con
// los requests HTTP normales si corre en el mismo proceso que el API. Un
// proceso dedicado aísla ese trabajo por completo — si se cuelga, se reinicia,
// o se satura, no afecta la disponibilidad del API.

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerRootModule } from './worker-root.module';

async function bootstrap() {
  const logger = new Logger('WorkerBootstrap');

  // createApplicationContext en vez de create(): arranca el árbol de DI de
  // Nest (para que @Processor, Prisma, etc. funcionen normalmente) sin
  // levantar ningún adapter HTTP.
  const app = await NestFactory.createApplicationContext(WorkerRootModule, {
    logger: ['log', 'warn', 'error'],
  });

  app.enableShutdownHooks();

  logger.log('Worker de importación escuchando jobs en la cola "importacion"...');

  // Apagado prolijo: BullMQ necesita terminar/soltar el job en curso antes
  // de que el proceso muera, si no puede quedar marcado como "stalled".
  const shutdown = async (signal: string) => {
    logger.log(`Señal ${signal} recibida, cerrando worker...`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap();