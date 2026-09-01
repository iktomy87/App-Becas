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
exports.AsignacionEngineService = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let AsignacionEngineService = class AsignacionEngineService {
    constructor(prisma, events) {
        this.prisma = prisma;
        this.events = events;
    }
    async ejecutar(convocatoriaId) {
        await this.prisma.corridaAsignacion.updateMany({
            where: { convocatoriaId, vigente: true },
            data: { estado: client_1.EstadoCorrida.INVALIDADA, vigente: false },
        });
        const corrida = await this.prisma.corridaAsignacion.create({
            data: { convocatoriaId, estado: client_1.EstadoCorrida.EN_CURSO, vigente: true },
        });
        const ranking = await this.prisma.resultadoRanking.findMany({
            where: { convocatoriaId, habilitado: true, posicion: { not: null } },
            orderBy: { posicion: 'asc' },
            include: {
                padron: {
                    include: {
                        postulaciones: {
                            where: { convocatoriaId },
                            orderBy: { ordenPreferencia: 'asc' },
                            include: { propuesta: true },
                        },
                    },
                },
            },
        });
        let asignados = 0;
        let noAsignados = 0;
        for (const entrada of ranking) {
            const padron = entrada.padron;
            let asignado = false;
            for (const postulacion of padron.postulaciones) {
                const propuesta = postulacion.propuesta;
                const resultado = await this.prisma.$transaction(async (tx) => {
                    const prop = await tx.propuesta.findUnique({
                        where: { id: propuesta.id },
                    });
                    if (!prop || prop.vacantesDisponibles <= 0)
                        return null;
                    await tx.propuesta.update({
                        where: { id: propuesta.id },
                        data: { vacantesDisponibles: { decrement: 1 } },
                    });
                    return prop;
                });
                if (resultado) {
                    await this.prisma.resultadoAsignacion.create({
                        data: {
                            corridaId: corrida.id,
                            padronId: padron.id,
                            propuestaId: propuesta.id,
                            preferenciaSatisfecha: postulacion.ordenPreferencia,
                            estado: client_1.EstadoAsignacion.ASIGNADO,
                        },
                    });
                    this.events.emit('asignacion.estudiante_asignado', {
                        padronId: padron.id,
                        propuestaId: propuesta.id,
                        corridaId: corrida.id,
                    });
                    asignados++;
                    asignado = true;
                    break;
                }
            }
            if (!asignado) {
                await this.prisma.resultadoAsignacion.create({
                    data: {
                        corridaId: corrida.id,
                        padronId: padron.id,
                        estado: client_1.EstadoAsignacion.NO_ASIGNADO,
                    },
                });
                this.events.emit('asignacion.estudiante_no_asignado', {
                    padronId: padron.id,
                    corridaId: corrida.id,
                });
                noAsignados++;
            }
        }
        await this.prisma.corridaAsignacion.update({
            where: { id: corrida.id },
            data: {
                estado: client_1.EstadoCorrida.COMPLETADA,
                totalPostulantes: ranking.length,
                totalAsignados: asignados,
                totalNoAsignados: noAsignados,
                finishedAt: new Date(),
            },
        });
        await this.prisma.convocatoria.update({
            where: { id: convocatoriaId },
            data: { estado: client_1.EstadoConvocatoria.ASIGNADA },
        });
        this.events.emit('asignacion.finalizada', {
            convocatoriaId,
            corridaId: corrida.id,
            asignados,
            noAsignados,
        });
        return { corridaId: corrida.id, asignados, noAsignados };
    }
    getResultados(convocatoriaId, page = 1, limit = 50) {
        return this.prisma.corridaAsignacion.findFirst({
            where: { convocatoriaId, vigente: true },
            include: {
                resultados: {
                    skip: (page - 1) * limit,
                    take: limit,
                    include: {
                        padron: {
                            select: { dni: true, legajo: true, nombreCompleto: true },
                        },
                        propuesta: { select: { idExterno: true, titulo: true } },
                    },
                    orderBy: { estado: 'asc' },
                },
            },
        });
    }
    getResultadoPorDni(convocatoriaId, dni) {
        return this.prisma.resultadoAsignacion.findFirst({
            where: { corrida: { convocatoriaId, vigente: true }, padron: { dni } },
            include: {
                propuesta: true,
                padron: { select: { nombreCompleto: true, dni: true } },
            },
        });
    }
};
exports.AsignacionEngineService = AsignacionEngineService;
exports.AsignacionEngineService = AsignacionEngineService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        event_emitter_1.EventEmitter2])
], AsignacionEngineService);
//# sourceMappingURL=asignacion-engine.service.js.map