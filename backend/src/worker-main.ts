import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerRootModule } from './worker-root.module';
import { setDefaultResultOrder } from 'node:dns';

setDefaultResultOrder('ipv4first');

async function bootstrap() {
  const logger = new Logger('WorkerBootstrap');

  const app = await NestFactory.createApplicationContext(WorkerRootModule, {
    logger: ['log', 'warn', 'error'],
  });

  app.enableShutdownHooks();
  logger.log('Worker de cola Postgres iniciado; esperando jobs...');

  const shutdown = async (signal: string) => {
    logger.log(`Señal ${signal} recibida, cerrando worker...`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap();
