import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { ImportacionService } from './importacion.service';
import { JobCargarPlanilla } from './importacion.processor';
export declare class ImportacionController {
    private readonly importacionQueue;
    private readonly prisma;
    private readonly importacionService;
    constructor(importacionQueue: Queue<JobCargarPlanilla>, prisma: PrismaService, importacionService: ImportacionService);
    subirPlanilla(convocatoriaId: string, file: Express.Multer.File): Promise<{
        jobId: string;
    }>;
    getStatus(jobId: string): Promise<{
        state: import("bullmq").JobState | "unknown";
        progress: import("bullmq").JobProgress;
        resultado: any;
        error: string;
    }>;
    listarPlanillas(convocatoriaId: string): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        convocatoriaId: string;
        filename: string;
        storagePath: string;
        estado: import(".prisma/client").$Enums.EstadoCarga;
        filasTotal: number;
        filasValidas: number;
        filasError: number;
        filasAdvertencia: number;
        reporteErrores: import("@prisma/client/runtime/client").JsonValue | null;
        reporteAdvertencias: import("@prisma/client/runtime/client").JsonValue | null;
        vigente: boolean;
        createdAt: Date;
    }[]>;
    getPlanilla(cargaId: string): Promise<{
        id: string;
        convocatoriaId: string;
        filename: string;
        storagePath: string;
        estado: import(".prisma/client").$Enums.EstadoCarga;
        filasTotal: number;
        filasValidas: number;
        filasError: number;
        filasAdvertencia: number;
        reporteErrores: import("@prisma/client/runtime/client").JsonValue | null;
        reporteAdvertencias: import("@prisma/client/runtime/client").JsonValue | null;
        vigente: boolean;
        createdAt: Date;
    }>;
    getPadron(convocatoriaId: string): import(".prisma/client").Prisma.PrismaPromise<({
        postulaciones: ({
            propuesta: {
                id: string;
                convocatoriaId: string;
                estado: import(".prisma/client").$Enums.EstadoPropuesta;
                createdAt: Date;
                idExterno: string;
                titulo: string;
                tipo: import(".prisma/client").$Enums.TipoPropuesta;
                responsableNombre: string;
                responsableEmail: string;
                vacantesTotal: number;
                vacantesDisponibles: number;
                dependencia: string | null;
                especialidades: string | null;
                periodo: string | null;
                horario: string | null;
                objetivo: string | null;
                tareas: string | null;
                observaciones: string | null;
                reqRegularizadas: string | null;
                reqAprobadas: string | null;
                reqOtros: string | null;
                modulos: number;
                updatedAt: Date;
            };
        } & {
            id: string;
            convocatoriaId: string;
            ordenPreferencia: number;
            padronId: string;
            propuestaId: string;
            cargaPlanillaId: string;
        })[];
    } & {
        id: string;
        convocatoriaId: string;
        estado: string;
        dni: string;
        legajo: string;
        nombreCompleto: string;
        especialidadCodigo: number | null;
        plan: number | null;
        anioIngreso: number | null;
        regularizadas: number;
        cursando: number;
        aprobadas: number;
        promedio: import("@prisma/client-runtime-utils").Decimal;
        aplazos: number;
    })[]>;
}
