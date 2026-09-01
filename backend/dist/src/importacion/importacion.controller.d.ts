import { ImportacionService } from './importacion.service';
export declare class ImportacionController {
    private readonly service;
    constructor(service: ImportacionService);
    cargar(convocatoriaId: string, file: Express.Multer.File): Promise<import("./importacion.service").ResultadoImportacion>;
    listar(convocatoriaId: string): import(".prisma/client").Prisma.PrismaPromise<{
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
    getCarga(cargaId: string): import(".prisma/client").Prisma.Prisma__CargaPlanillaClient<{
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
}
