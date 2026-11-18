export type JobStatusState = 'waiting' | 'active' | 'completed' | 'failed';

export interface QueueJob<T = unknown> {
  id: string;
  queue: string;
  name: string;
  data: T;
  updateProgress(value: unknown): Promise<void>;
}

export interface JobStatus<R = unknown> {
  state: JobStatusState;
  progress: unknown;
  resultado?: R;
  error?: string;
}

export type JobHandler = (job: QueueJob<any>) => Promise<unknown>;
