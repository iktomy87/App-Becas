import { PrismaService } from '../prisma/prisma.service';
import { RankingV1Strategy } from './strategies/ranking-v1.strategy';
export declare class RankingService {
    private readonly prisma;
    private readonly strategy;
    constructor(prisma: PrismaService, strategy: RankingV1Strategy);
    calcularRanking(convocatoriaId: string): Promise<{
        calculados: number;
        inhabilitados: number;
    }>;
    getRanking(convocatoriaId: string, page?: number, limit?: number): Promise<{
        data: ({
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
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    getDesglose(convocatoriaId: string, dni: string): import(".prisma/client").Prisma.Prisma__ResultadoRankingClient<{
        rankingConfig: {
            id: string;
            nombre: string;
            createdAt: Date;
            convocatoriaId: string;
            minMateriasCursando: number;
            minRegularizadas: number;
            criterioDesempate: string;
            version: number;
            tipo: string;
        };
        padron: {
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
