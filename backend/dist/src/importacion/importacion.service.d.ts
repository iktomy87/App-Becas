import { PrismaService } from '../prisma/prisma.service';
import { PadronService } from '../padron/padron.service';
import { ErrorFila } from './planilla-verifier';
import { ArchivoPlanilla } from './archivo-planilla.interface';
export interface ResultadoImportacion {
    cargaId: string;
    filasTotal: number;
    filasValidas: number;
    filasError: number;
    filasConAdvertencias: number;
    filasRequierenConfirmacion: number;
    errores: ErrorFila[];
    advertencias: ErrorFila[];
    confirmacionesPendientes: {
        fila: number;
        mensaje: string;
        dni: string;
    }[];
}
export declare class ImportacionService {
    private readonly prisma;
    private readonly padronService;
    constructor(prisma: PrismaService, padronService: PadronService);
    cargarPlanilla(convocatoriaId: string, file: ArchivoPlanilla, onProgress?: (rowsProcessed: number) => void): Promise<ResultadoImportacion>;
    private procesarFila;
    private procesarCsvStreaming;
    private upsertPostulacionesBulk;
    getCarga(id: string): import(".prisma/client").Prisma.Prisma__CargaPlanillaClient<{
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
    }, null, import("@prisma/client/runtime/client").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    listarCargas(convocatoriaId: string): import(".prisma/client").Prisma.PrismaPromise<{
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
    getInscripciones(convocatoriaId: string): import(".prisma/client").Prisma.PrismaPromise<({
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
