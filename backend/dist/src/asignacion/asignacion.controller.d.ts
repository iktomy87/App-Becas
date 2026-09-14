import { AsignacionEngineService } from './asignacion-engine.service';
export declare class AsignacionController {
    private readonly engine;
    constructor(engine: AsignacionEngineService);
    ejecutar(convocatoriaId: string): Promise<{
        corridaId: string;
        asignados: number;
        noAsignados: number;
    }>;
    getResultados(convocatoriaId: string, page?: number, limit?: number): import(".prisma/client").Prisma.Prisma__CorridaAsignacionClient<{
        resultados: ({
            padron: {
                legajo: string;
                dni: string;
                nombreCompleto: string;
            };
            propuesta: {
                idExterno: string;
                titulo: string;
            };
        } & {
            id: string;
            estado: import(".prisma/client").$Enums.EstadoAsignacion;
            propuestaId: string | null;
            padronId: string;
            preferenciaSatisfecha: number | null;
            corridaId: string;
        })[];
    } & {
        id: string;
        estado: import(".prisma/client").$Enums.EstadoCorrida;
        convocatoriaId: string;
        vigente: boolean;
        totalPostulantes: number;
        totalAsignados: number;
        totalNoAsignados: number;
        startedAt: Date;
        finishedAt: Date | null;
    }, null, import("@prisma/client/runtime/client").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    getResultadoPorDni(convocatoriaId: string, dni: string): import(".prisma/client").Prisma.Prisma__ResultadoAsignacionClient<{
        padron: {
            dni: string;
            nombreCompleto: string;
        };
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
        estado: import(".prisma/client").$Enums.EstadoAsignacion;
        propuestaId: string | null;
        padronId: string;
        preferenciaSatisfecha: number | null;
        corridaId: string;
    }, null, import("@prisma/client/runtime/client").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
}
