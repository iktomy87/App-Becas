import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { EstadoJob, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { QueueJob } from './job.interface';
import { QueueService } from './queue.service';

interface ClaimedJob {
  id: string;
  queue: string;
  name: string;
  data: unknown;
  progress: unknown;
}

@Injectable()
export class QueueWorkerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(QueueWorkerService.name);
  private readonly instanceId = randomUUID();
  private timer?: ReturnType<typeof setInterval>;
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.QUEUE_WORKER_ENABLED === 'false') return;

    const pollMs = Number(process.env.QUEUE_POLL_INTERVAL_MS ?? 1500);
    this.timer = setInterval(() => void this.tick(), pollMs);
    this.timer.unref?.();
    this.logger.log(
      `Worker de cola Postgres iniciado (poll ${pollMs}ms, instancia ${this.instanceId})`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      const queues = this.queueService.registeredQueues;
      if (queues.length === 0) return;

      await this.prisma.jobQueue.updateMany({
        where: {
          state: EstadoJob.ACTIVE,
          lockedAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
        },
        data: { state: EstadoJob.WAITING, lockedAt: null, lockedBy: null },
      });

      await this.prisma.jobQueue.deleteMany({
        where: {
          state: EstadoJob.COMPLETED,
          finishedAt: { lt: new Date(Date.now() - 60 * 60 * 1000) },
        },
      });

      for (let i = 0; i < 4; i += 1) {
        const claimed = await this.claim(queues);
        if (!claimed) break;
        await this.process(claimed);
      }
    } catch (err: any) {
      this.logger.error(`Error en poll de cola: ${err.message}`, err.stack);
    } finally {
      this.processing = false;
    }
  }

  private async claim(queues: string[]): Promise<ClaimedJob | undefined> {
    const rows = await this.prisma.$queryRaw<ClaimedJob[]>(Prisma.sql`
      WITH next AS (
        SELECT "id"
        FROM "job_queue"
        WHERE "state" = 'WAITING'::"EstadoJob"
          AND "queue" = ANY(${queues}::text[])
        ORDER BY "created_at" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE "job_queue" q
      SET "state" = 'ACTIVE'::"EstadoJob",
          "locked_at" = NOW(),
          "locked_by" = ${this.instanceId}
      FROM next
      WHERE q."id" = next."id"
      RETURNING q."id", q."queue", q."name", q."data", q."progress"
    `);
    return rows[0];
  }

  private async process(claimed: ClaimedJob): Promise<void> {
    const handler = this.queueService.getHandler(claimed.queue);
    if (!handler) {
      await this.queueService.requeue(claimed.id);
      return;
    }

    const job: QueueJob = {
      id: claimed.id,
      queue: claimed.queue,
      name: claimed.name,
      data: claimed.data,
      updateProgress: async (value) =>
        this.queueService.setProgress(claimed.id, value),
    };

    this.logger.log(`Procesando job=${claimed.id} cola=${claimed.queue}`);
    try {
      const result = await handler(job);
      await this.queueService.complete(claimed.id, result);
      this.logger.log(`Job=${claimed.id} completado`);
    } catch (err: any) {
      const message = err?.message ?? String(err);
      this.logger.error(`Job=${claimed.id} falló: ${message}`, err?.stack);
      await this.queueService.fail(claimed.id, message);
    }
  }
}
