import { PrismaService } from '../prisma/prisma.service';
export declare class PadronService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findByDni(dni: string, convocatoriaId: string): Promise<{
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
    }>;
    findByLegajo(legajo: string, convocatoriaId: string): Promise<{
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
    }>;
    cargarMaestro(filePath: string, convocatoriaId: string): Promise<{
        procesadas: number;
        errores: number;
    }>;
}
