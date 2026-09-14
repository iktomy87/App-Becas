"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RankingService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ranking_v1_strategy_1 = require("./strategies/ranking-v1.strategy");
const client_1 = require("@prisma/client");
let RankingService = class RankingService {
    constructor(prisma, strategy) {
        this.prisma = prisma;
        this.strategy = strategy;
    }
    async calcularRanking(convocatoriaId) {
        const conv = await this.prisma.convocatoria.findUnique({
            where: { id: convocatoriaId },
            include: { rankingConfig: true },
        });
        if (!conv)
            throw new Error('Convocatoria no encontrada');
        if (conv.estado !== client_1.EstadoConvocatoria.CERRADA && conv.estado !== client_1.EstadoConvocatoria.EN_RANKING) {
            throw new Error('La convocatoria debe estar CERRADA para calcular el ranking');
        }
        const config = conv.rankingConfig ?? { minMateriasCursando: 3, minRegularizadas: 1, criterioDesempate: 'PROMEDIO', id: '' };
        await this.prisma.convocatoria.update({ where: { id: convocatoriaId }, data: { estado: client_1.EstadoConvocatoria.EN_RANKING } });
        const postulantesUnicos = await this.prisma.postulacion.findMany({
            where: { convocatoriaId },
            select: { padronId: true },
            distinct: ['padronId'],
        });
        let calculados = 0;
        let inhabilitados = 0;
        for (const { padronId } of postulantesUnicos) {
            const padron = await this.prisma.padronAcademico.findUnique({ where: { id: padronId } });
            if (!padron)
                continue;
            const habilitacion = this.strategy.verificarHabilitacion(padron, {
                minMateriasCursando: config.minMateriasCursando,
                minRegularizadas: config.minRegularizadas,
            });
            const desglose = habilitacion.habilitado
                ? this.strategy.calcularPuntaje(padron)
                : { terminoPromedio: 0, terminoAprobadas: 0, terminoAvance: 0, terminoAplazos: 0, bonusAntecedentes: 0, puntajeTotal: 0 };
            await this.prisma.resultadoRanking.upsert({
                where: { padronId_convocatoriaId: { padronId, convocatoriaId } },
                create: {
                    padronId,
                    convocatoriaId,
                    rankingConfigId: config.id,
                    puntajeTotal: desglose.puntajeTotal,
                    terminoPromedio: desglose.terminoPromedio,
                    terminoAprobadas: desglose.terminoAprobadas,
                    terminoAvance: desglose.terminoAvance,
                    terminoAplazos: desglose.terminoAplazos,
                    bonusAntecedentes: desglose.bonusAntecedentes,
                    habilitado: habilitacion.habilitado,
                    motivoInhabilitacion: habilitacion.motivo ?? null,
                    criterioDesempateVal: Number(padron.promedio),
                },
                update: {
                    puntajeTotal: desglose.puntajeTotal,
                    terminoPromedio: desglose.terminoPromedio,
                    terminoAprobadas: desglose.terminoAprobadas,
                    terminoAvance: desglose.terminoAvance,
                    terminoAplazos: desglose.terminoAplazos,
                    habilitado: habilitacion.habilitado,
                    motivoInhabilitacion: habilitacion.motivo ?? null,
                },
            });
            habilitacion.habilitado ? calculados++ : inhabilitados++;
        }
        const rankingOrdenado = await this.prisma.resultadoRanking.findMany({
            where: { convocatoriaId, habilitado: true },
            orderBy: [{ puntajeTotal: 'desc' }, { criterioDesempateVal: 'desc' }],
        });
        for (let i = 0; i < rankingOrdenado.length; i++) {
            await this.prisma.resultadoRanking.update({
                where: { id: rankingOrdenado[i].id },
                data: { posicion: i + 1 },
            });
        }
        return { calculados, inhabilitados };
    }
    async getRanking(convocatoriaId, page = 1, limit = 50) {
        const [data, total] = await Promise.all([
            this.prisma.resultadoRanking.findMany({
                where: { convocatoriaId },
                orderBy: [{ posicion: 'asc' }, { puntajeTotal: 'desc' }],
                skip: (page - 1) * limit,
                take: limit,
                include: { padron: { select: { dni: true, legajo: true, nombreCompleto: true } } },
            }),
            this.prisma.resultadoRanking.count({ where: { convocatoriaId } }),
        ]);
        return {
            data,
            total,
            page,
            limit,
        };
    }
    getDesglose(convocatoriaId, dni) {
        return this.prisma.resultadoRanking.findFirst({
            where: { convocatoriaId, padron: { dni } },
            include: { padron: true, rankingConfig: true },
        });
    }
};
exports.RankingService = RankingService;
exports.RankingService = RankingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ranking_v1_strategy_1.RankingV1Strategy])
], RankingService);
//# sourceMappingURL=ranking.service.js.map