import { PrismaService } from '../prisma/prisma.service';
import { PadronService } from '../padron/padron.service';
import { ErrorFila } from './planilla-verifier';
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
    cargarPlanilla(convocatoriaId: string, file: Express.Multer.File): Promise<ResultadoImportacion>;
    getCarga(id: string): import(".prisma/client").Prisma.Prisma__CargaPlanillaClient<{
        id: string;
        estado: import(".prisma/client").$Enums.EstadoCarga;
        createdAt: Date;
        convocatoriaId: string;
        filename: string;
        storagePath: string;
        filasTotal: number;
        filasValidas: number;
        filasError: number;
        filasAdvertencia: number;
        reporteErrores: import("@prisma/client/runtime/client").JsonValue | null;
        reporteAdvertencias: import("@prisma/client/runtime/client").JsonValue | null;
        vigente: boolean;
    }, null, import("@prisma/client/runtime/client").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    listarCargas(convocatoriaId: string): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        estado: import(".prisma/client").$Enums.EstadoCarga;
        createdAt: Date;
        convocatoriaId: string;
        filename: string;
        storagePath: string;
        filasTotal: number;
        filasValidas: number;
        filasError: number;
        filasAdvertencia: number;
        reporteErrores: import("@prisma/client/runtime/client").JsonValue | null;
        reporteAdvertencias: import("@prisma/client/runtime/client").JsonValue | null;
        vigente: boolean;
    }[]>;
    getInscripciones(convocatoriaId: string): import(".prisma/client").Prisma.PrismaPromise<({
        postulaciones: ({
            propuesta: {
                id: string;
                estado: import(".prisma/client").$Enums.EstadoPropuesta;
                createdAt: Date;
                updatedAt: Date;
                convocatoriaId: string;
                tipo: import(".prisma/client").$Enums.TipoPropuesta;
                idExterno: string;
                titulo: string;
                responsableNombre: string;
                responsableEmail: string;
                vacantesTotal: number;
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
                vacantesDisponibles: number;
            };
        } & {
            id: string;
            convocatoriaId: string;
            propuestaId: string;
            padronId: string;
            cargaPlanillaId: string;
            ordenPreferencia: number;
        })[];
    } & {
        id: string;
        estado: string;
        convocatoriaId: string;
        especialidadCodigo: number | null;
        plan: number | null;
        legajo: string;
        anioIngreso: number | null;
        dni: string;
        nombreCompleto: string;
        regularizadas: number;
        cursando: number;
        aprobadas: number;
        promedio: import("@prisma/client-runtime-utils").Decimal;
        aplazos: number;
    })[]>;
}
