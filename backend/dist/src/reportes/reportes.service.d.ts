import { PrismaService } from '../prisma/prisma.service';
export declare class ReportesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    generarReporteAsignacion(convocatoriaId: string): Promise<string>;
}
