import { RankingService } from './ranking.service';
export declare class RankingController {
    private readonly service;
    constructor(service: RankingService);
    calcular(convocatoriaId: string): Promise<{
        calculados: number;
        inhabilitados: number;
    }>;
    getRanking(convocatoriaId: string, page?: number, limit?: number): import(".prisma/client").Prisma.PrismaPromise<({
        padron: {
            legajo: string;
            dni: string;
            nombreCompleto: string;
        };
    } & {
        id: string;
        createdAt: Date;
        convocatoriaId: string;
        padronId: string;
        rankingConfigId: string;
        posicion: number | null;
        puntajeTotal: import("@prisma/client-runtime-utils").Decimal;
        terminoPromedio: import("@prisma/client-runtime-utils").Decimal;
        terminoAprobadas: import("@prisma/client-runtime-utils").Decimal;
        terminoAvance: import("@prisma/client-runtime-utils").Decimal;
        terminoAplazos: import("@prisma/client-runtime-utils").Decimal;
        bonusAntecedentes: import("@prisma/client-runtime-utils").Decimal;
        habilitado: boolean;
        motivoInhabilitacion: string | null;
        criterioDesempateVal: import("@prisma/client-runtime-utils").Decimal | null;
    })[]>;
    getDesglose(convocatoriaId: string, dni: string): import(".prisma/client").Prisma.Prisma__ResultadoRankingClient<{
        rankingConfig: {
            nombre: string;
            minMateriasCursando: number;
            minRegularizadas: number;
            criterioDesempate: string;
            id: string;
            createdAt: Date;
            convocatoriaId: string;
            version: number;
            tipo: string;
        };
        padron: {
            estado: string;
            id: string;
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
        };
    } & {
        id: string;
        createdAt: Date;
        convocatoriaId: string;
        padronId: string;
        rankingConfigId: string;
        posicion: number | null;
        puntajeTotal: import("@prisma/client-runtime-utils").Decimal;
        terminoPromedio: import("@prisma/client-runtime-utils").Decimal;
        terminoAprobadas: import("@prisma/client-runtime-utils").Decimal;
        terminoAvance: import("@prisma/client-runtime-utils").Decimal;
        terminoAplazos: import("@prisma/client-runtime-utils").Decimal;
        bonusAntecedentes: import("@prisma/client-runtime-utils").Decimal;
        habilitado: boolean;
        motivoInhabilitacion: string | null;
        criterioDesempateVal: import("@prisma/client-runtime-utils").Decimal | null;
    }, null, import("@prisma/client/runtime/client").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
}
