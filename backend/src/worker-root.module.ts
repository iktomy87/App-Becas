import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ImportacionWorkerModule } from './importacion/importacion-worker.module';

// Módulo raíz que se bootstrapea en worker-main.ts (equivalente al AppModule
// del proceso API, pero solo con lo que el worker necesita). El
// BullModule.forRoot es imprescindible acá: sin esto, cualquier @Processor
// que se registre en un módulo hijo explota con "Worker requires a
// connection", porque nunca se le pasó la config de Redis.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // carga el mismo .env que usa el proceso API
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
        // password: process.env.REDIS_PASSWORD,
      },
    }),
    ImportacionWorkerModule,
  ],
})
export class WorkerRootModule {}
