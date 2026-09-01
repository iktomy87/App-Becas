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
exports.ConvocatoriasService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let ConvocatoriasService = class ConvocatoriasService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    findAll() {
        return this.prisma.convocatoria.findMany({
            orderBy: { createdAt: 'desc' },
            include: { rankingConfig: true, _count: { select: { propuestas: true, cargas: true } } },
        });
    }
    async findOne(id) {
        const conv = await this.prisma.convocatoria.findUnique({
            where: { id },
            include: { rankingConfig: true },
        });
        if (!conv)
            throw new common_1.NotFoundException(`Convocatoria ${id} no encontrada`);
        return conv;
    }
    create(dto) {
        return this.prisma.convocatoria.create({
            data: {
                nombre: dto.nombre,
                fechaApertura: new Date(dto.fechaApertura),
                fechaCierre: new Date(dto.fechaCierre),
            },
        });
    }
    async update(id, dto) {
        await this.findOne(id);
        return this.prisma.convocatoria.update({
            where: { id },
            data: {
                ...(dto.nombre && { nombre: dto.nombre }),
                ...(dto.fechaApertura && { fechaApertura: new Date(dto.fechaApertura) }),
                ...(dto.fechaCierre && { fechaCierre: new Date(dto.fechaCierre) }),
            },
        });
    }
    async cerrar(id) {
        const conv = await this.findOne(id);
        if (conv.estado !== client_1.EstadoConvocatoria.ABIERTA) {
            throw new common_1.ConflictException(`La convocatoria no está en estado ABIERTA (actual: ${conv.estado})`);
        }
        return this.prisma.convocatoria.update({
            where: { id },
            data: { estado: client_1.EstadoConvocatoria.CERRADA },
        });
    }
    async upsertRankingConfig(id, dto) {
        await this.findOne(id);
        return this.prisma.rankingConfig.upsert({
            where: { convocatoriaId: id },
            create: {
                convocatoriaId: id,
                minMateriasCursando: dto.minMateriasCursando ?? 3,
                minRegularizadas: dto.minRegularizadas ?? 1,
                criterioDesempate: dto.criterioDesempate ?? 'PROMEDIO',
            },
            update: {
                ...(dto.minMateriasCursando !== undefined && { minMateriasCursando: dto.minMateriasCursando }),
                ...(dto.minRegularizadas !== undefined && { minRegularizadas: dto.minRegularizadas }),
                ...(dto.criterioDesempate && { criterioDesempate: dto.criterioDesempate }),
                version: { increment: 1 },
            },
        });
    }
};
exports.ConvocatoriasService = ConvocatoriasService;
exports.ConvocatoriasService = ConvocatoriasService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ConvocatoriasService);
//# sourceMappingURL=convocatorias.service.js.map