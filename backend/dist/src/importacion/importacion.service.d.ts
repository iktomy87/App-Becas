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
        estado: import(".prisma/client").$Enums.EstadoCarga;
        id: string;
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
        estado: import(".prisma/client").$Enums.EstadoCarga;
        id: string;
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
}
