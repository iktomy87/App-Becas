-- CreateEnum
CREATE TYPE "EstadoJob" AS ENUM ('WAITING', 'ACTIVE', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "job_queue" (
    "id" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "state" "EstadoJob" NOT NULL DEFAULT 'WAITING',
    "progress" JSONB,
    "result" JSONB,
    "error" TEXT,
    "locked_at" TIMESTAMP(3),
    "locked_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "job_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_queue_queue_state_created_at_idx" ON "job_queue"("queue", "state", "created_at");

-- CreateIndex
CREATE INDEX "job_queue_state_locked_at_idx" ON "job_queue"("state", "locked_at");

-- Bucket privado para los Excel (solo existe en Supabase)
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit)
    VALUES ('archivos', 'archivos', false, 2147483648)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
