import { Injectable } from '@nestjs/common';
import { EstadoJob, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JobHandler, JobStatus, JobStatusState } from './job.interface';

@Injectable()
export class QueueService {
  private readonly handlers = new Map<string, JobHandler>();

  constructor(private readonly prisma: PrismaService) {}

  registerHandler(queue: string, handler: JobHandler): void {
    this.handlers.set(queue, handler);
  }

  get registeredQueues(): string[] {
    return [...this.handlers.keys()];
  }

  getHandler(queue: string): JobHandler | undefined {
    return this.handlers.get(queue);
  }

  async enqueue(
    queue: string,
    name: string,
    data: unknown,
  ): Promise<{ id: string }> {
    const job = await this.prisma.jobQueue.create({
      data: {
        queue,
        name,
        data: this.toJson(data),
      },
      select: { id: true },
    });
    return { id: job.id };
  }

  async status(id: string): Promise<JobStatus | undefined> {
    const job = await this.prisma.jobQueue.findUnique({ where: { id } });
    if (!job) return undefined;

    const state = job.state.toLowerCase() as JobStatusState;
    const status: JobStatus = {
      state,
      progress: job.progress ?? 0,
    };
    if (state === 'completed') status.resultado = job.result ?? undefined;
    if (state === 'failed') status.error = job.error ?? 'Error desconocido';
    return status;
  }

  toJson(value: unknown): Prisma.InputJsonValue {
    if (value === undefined || value === null) {
      return Prisma.JsonNull as unknown as Prisma.InputJsonValue;
    }
    try {
      return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
    } catch {
      return String(value);
    }
  }

  async setProgress(id: string, value: unknown): Promise<void> {
    await this.prisma.jobQueue.update({
      where: { id },
      data: { progress: this.toJson(value) },
    });
  }

  async complete(id: string, result: unknown): Promise<void> {
    await this.prisma.jobQueue.update({
      where: { id },
      data: {
        state: EstadoJob.COMPLETED,
        result: this.toJson(result),
        finishedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      },
    });
  }

  async fail(id: string, error: string): Promise<void> {
    await this.prisma.jobQueue.update({
      where: { id },
      data: {
        state: EstadoJob.FAILED,
        error,
        finishedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      },
    });
  }

  async requeue(id: string): Promise<void> {
    await this.prisma.jobQueue.update({
      where: { id },
      data: { state: EstadoJob.WAITING, lockedAt: null, lockedBy: null },
    });
  }
}
