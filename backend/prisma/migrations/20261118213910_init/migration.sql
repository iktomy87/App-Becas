-- CreateEnum
CREATE TYPE "EstadoConvocatoria" AS ENUM ('ABIERTA', 'CERRADA', 'EN_RANKING', 'ASIGNADA');

-- CreateEnum
CREATE TYPE "TipoPropuesta" AS ENUM ('SERVICIO', 'INVESTIGACION');

-- CreateEnum
CREATE TYPE "EstadoPropuesta" AS ENUM ('BORRADOR', 'PUBLICADA');

-- CreateEnum
CREATE TYPE "EstadoCarga" AS ENUM ('PENDIENTE', 'PROCESANDO', 'COMPLETADA', 'ERROR');

-- CreateEnum
CREATE TYPE "EstadoCorrida" AS ENUM ('EN_CURSO', 'COMPLETADA', 'INVALIDADA');

-- CreateEnum
CREATE TYPE "EstadoAsignacion" AS ENUM ('ASIGNADO', 'NO_ASIGNADO');

-- CreateTable
CREATE TABLE "convocatorias" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fecha_apertura" TIMESTAMP(3) NOT NULL,
    "fecha_cierre" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoConvocatoria" NOT NULL DEFAULT 'ABIERTA',
    "antecedentes_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "convocatorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "propuestas" (
    "id" TEXT NOT NULL,
    "id_externo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" "TipoPropuesta" NOT NULL,
    "responsable_nombre" TEXT NOT NULL,
    "responsable_email" TEXT NOT NULL,
    "vacantes_total" INTEGER NOT NULL,
    "vacantes_disponibles" INTEGER NOT NULL,
    "dependencia" TEXT,
    "especialidades" TEXT,
    "periodo" TEXT,
    "horario" TEXT,
    "objetivo" TEXT,
    "tareas" TEXT,
    "observaciones" TEXT,
    "req_regularizadas" TEXT,
    "req_aprobadas" TEXT,
    "req_otros" TEXT,
    "modulos" INTEGER NOT NULL DEFAULT 1,
    "estado" "EstadoPropuesta" NOT NULL DEFAULT 'BORRADOR',
    "convocatoria_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "propuestas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vacante_auditoria" (
    "id" TEXT NOT NULL,
    "propuesta_id" TEXT NOT NULL,
    "valor_anterior" INTEGER NOT NULL,
    "valor_nuevo" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vacante_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "padron_academico" (
    "id" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "legajo" TEXT NOT NULL,
    "nombre_completo" TEXT NOT NULL,
    "especialidad_codigo" INTEGER,
    "plan" INTEGER,
    "anio_ingreso" INTEGER,
    "regularizadas" INTEGER NOT NULL DEFAULT 0,
    "cursando" INTEGER NOT NULL DEFAULT 0,
    "aprobadas" INTEGER NOT NULL DEFAULT 0,
    "promedio" DECIMAL(5,2) NOT NULL,
    "aplazos" INTEGER NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'Activo',
    "convocatoria_id" TEXT NOT NULL,

    CONSTRAINT "padron_academico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ranking_config" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "nombre" TEXT NOT NULL DEFAULT 'RankingV1',
    "tipo" TEXT NOT NULL DEFAULT 'SERVICIO',
    "min_materias_cursando" INTEGER NOT NULL DEFAULT 3,
    "min_regularizadas" INTEGER NOT NULL DEFAULT 1,
    "criterio_desempate" TEXT NOT NULL DEFAULT 'PROMEDIO',
    "convocatoria_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ranking_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carga_planillas" (
    "id" TEXT NOT NULL,
    "convocatoria_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "estado" "EstadoCarga" NOT NULL DEFAULT 'PENDIENTE',
    "filas_total" INTEGER NOT NULL DEFAULT 0,
    "filas_validas" INTEGER NOT NULL DEFAULT 0,
    "filas_error" INTEGER NOT NULL DEFAULT 0,
    "filas_advertencia" INTEGER NOT NULL DEFAULT 0,
    "reporte_errores" JSONB,
    "reporte_advertencias" JSONB,
    "vigente" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carga_planillas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "postulaciones" (
    "id" TEXT NOT NULL,
    "padron_id" TEXT NOT NULL,
    "propuesta_id" TEXT NOT NULL,
    "convocatoria_id" TEXT NOT NULL,
    "carga_planilla_id" TEXT NOT NULL,
    "orden_preferencia" INTEGER NOT NULL,

    CONSTRAINT "postulaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resultados_ranking" (
    "id" TEXT NOT NULL,
    "padron_id" TEXT NOT NULL,
    "convocatoria_id" TEXT NOT NULL,
    "ranking_config_id" TEXT NOT NULL,
    "posicion" INTEGER,
    "puntaje_total" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "termino_promedio" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "termino_aprobadas" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "termino_avance" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "termino_aplazos" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "bonus_antecedentes" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "habilitado" BOOLEAN NOT NULL DEFAULT true,
    "motivo_inhabilitacion" TEXT,
    "criterio_desempate_val" DECIMAL(8,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resultados_ranking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corridas_asignacion" (
    "id" TEXT NOT NULL,
    "convocatoria_id" TEXT NOT NULL,
    "estado" "EstadoCorrida" NOT NULL DEFAULT 'EN_CURSO',
    "total_postulantes" INTEGER NOT NULL DEFAULT 0,
    "total_asignados" INTEGER NOT NULL DEFAULT 0,
    "total_no_asignados" INTEGER NOT NULL DEFAULT 0,
    "vigente" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "corridas_asignacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resultados_asignacion" (
    "id" TEXT NOT NULL,
    "corrida_id" TEXT NOT NULL,
    "padron_id" TEXT NOT NULL,
    "propuesta_id" TEXT,
    "preferencia_satisfecha" INTEGER,
    "estado" "EstadoAsignacion" NOT NULL,

    CONSTRAINT "resultados_asignacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "propuestas_id_externo_key" ON "propuestas"("id_externo");

-- CreateIndex
CREATE INDEX "padron_academico_dni_idx" ON "padron_academico"("dni");

-- CreateIndex
CREATE INDEX "padron_academico_legajo_idx" ON "padron_academico"("legajo");

-- CreateIndex
CREATE UNIQUE INDEX "padron_academico_dni_convocatoria_id_key" ON "padron_academico"("dni", "convocatoria_id");

-- CreateIndex
CREATE UNIQUE INDEX "ranking_config_convocatoria_id_key" ON "ranking_config"("convocatoria_id");

-- CreateIndex
CREATE UNIQUE INDEX "postulaciones_padron_id_convocatoria_id_orden_preferencia_key" ON "postulaciones"("padron_id", "convocatoria_id", "orden_preferencia");

-- CreateIndex
CREATE UNIQUE INDEX "resultados_ranking_padron_id_convocatoria_id_key" ON "resultados_ranking"("padron_id", "convocatoria_id");

-- CreateIndex
CREATE UNIQUE INDEX "resultados_asignacion_corrida_id_padron_id_key" ON "resultados_asignacion"("corrida_id", "padron_id");

-- AddForeignKey
ALTER TABLE "propuestas" ADD CONSTRAINT "propuestas_convocatoria_id_fkey" FOREIGN KEY ("convocatoria_id") REFERENCES "convocatorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacante_auditoria" ADD CONSTRAINT "vacante_auditoria_propuesta_id_fkey" FOREIGN KEY ("propuesta_id") REFERENCES "propuestas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "padron_academico" ADD CONSTRAINT "padron_academico_convocatoria_id_fkey" FOREIGN KEY ("convocatoria_id") REFERENCES "convocatorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_config" ADD CONSTRAINT "ranking_config_convocatoria_id_fkey" FOREIGN KEY ("convocatoria_id") REFERENCES "convocatorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carga_planillas" ADD CONSTRAINT "carga_planillas_convocatoria_id_fkey" FOREIGN KEY ("convocatoria_id") REFERENCES "convocatorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postulaciones" ADD CONSTRAINT "postulaciones_padron_id_fkey" FOREIGN KEY ("padron_id") REFERENCES "padron_academico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postulaciones" ADD CONSTRAINT "postulaciones_propuesta_id_fkey" FOREIGN KEY ("propuesta_id") REFERENCES "propuestas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postulaciones" ADD CONSTRAINT "postulaciones_convocatoria_id_fkey" FOREIGN KEY ("convocatoria_id") REFERENCES "convocatorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postulaciones" ADD CONSTRAINT "postulaciones_carga_planilla_id_fkey" FOREIGN KEY ("carga_planilla_id") REFERENCES "carga_planillas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_ranking" ADD CONSTRAINT "resultados_ranking_padron_id_fkey" FOREIGN KEY ("padron_id") REFERENCES "padron_academico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_ranking" ADD CONSTRAINT "resultados_ranking_convocatoria_id_fkey" FOREIGN KEY ("convocatoria_id") REFERENCES "convocatorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_ranking" ADD CONSTRAINT "resultados_ranking_ranking_config_id_fkey" FOREIGN KEY ("ranking_config_id") REFERENCES "ranking_config"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corridas_asignacion" ADD CONSTRAINT "corridas_asignacion_convocatoria_id_fkey" FOREIGN KEY ("convocatoria_id") REFERENCES "convocatorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_asignacion" ADD CONSTRAINT "resultados_asignacion_corrida_id_fkey" FOREIGN KEY ("corrida_id") REFERENCES "corridas_asignacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_asignacion" ADD CONSTRAINT "resultados_asignacion_padron_id_fkey" FOREIGN KEY ("padron_id") REFERENCES "padron_academico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_asignacion" ADD CONSTRAINT "resultados_asignacion_propuesta_id_fkey" FOREIGN KEY ("propuesta_id") REFERENCES "propuestas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
