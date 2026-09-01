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
exports.PropuestasService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let PropuestasService = class PropuestasService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    findAll(convocatoriaId) {
        return this.prisma.propuesta.findMany({
            where: { ...(convocatoriaId && { convocatoriaId }) },
            orderBy: { titulo: 'asc' },
        });
    }
    async findOne(id) {
        const prop = await this.prisma.propuesta.findUnique({ where: { id } });
        if (!prop)
            throw new common_1.NotFoundException(`Propuesta ${id} no encontrada`);
        return prop;
    }
    async create(dto) {
        return this.prisma.propuesta.create({
            data: {
                ...dto,
                vacantesDisponibles: dto.vacantesTotal,
            },
        });
    }
    async publicar(id) {
        const prop = await this.findOne(id);
        if (prop.estado === client_1.EstadoPropuesta.PUBLICADA) {
            throw new common_1.ConflictException('La propuesta ya está publicada');
        }
        return this.prisma.propuesta.update({
            where: { id },
            data: { estado: client_1.EstadoPropuesta.PUBLICADA },
        });
    }
    async updateVacantes(id, dto) {
        const prop = await this.findOne(id);
        const conv = await this.prisma.convocatoria.findUnique({ where: { id: prop.convocatoriaId } });
        if (conv && conv.estado !== client_1.EstadoConvocatoria.ABIERTA) {
            throw new common_1.ConflictException('No se pueden modificar vacantes con la convocatoria cerrada (RN-02)');
        }
        const valorAnterior = prop.vacantesTotal;
        const diff = dto.vacantesTotal - valorAnterior;
        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.propuesta.update({
                where: { id },
                data: {
                    vacantesTotal: dto.vacantesTotal,
                    vacantesDisponibles: { increment: diff },
                },
            });
            await tx.vacanteAuditoria.create({
                data: { propuestaId: id, valorAnterior, valorNuevo: dto.vacantesTotal },
            });
            return updated;
        });
    }
    async importarDesdeXls(rows, convocatoriaId) {
        const created = [];
        for (const row of rows) {
            const existing = await this.prisma.propuesta.findUnique({
                where: { idExterno: String(row.numero) },
            });
            if (existing)
                continue;
            const tipo = row.tipo === 'I' ? 'INVESTIGACION' : 'SERVICIO';
            const prop = await this.prisma.propuesta.create({
                data: {
                    idExterno: String(row.numero),
                    titulo: row.proyecto || row.area_servicio || row.area_investigacion || '',
                    tipo,
                    responsableNombre: row.responsable_ayn ?? '',
                    responsableEmail: row.responsable_email ?? '',
                    vacantesTotal: Number(row.cantidad_becarios) || 1,
                    vacantesDisponibles: Number(row.cantidad_becarios) || 1,
                    modulos: Number(row.cantidad_modulos) || 1,
                    dependencia: row['dependencia__nombre'] ?? null,
                    especialidades: row.especialidad ?? null,
                    periodo: row.periodo ?? null,
                    horario: row.horario ?? null,
                    objetivo: row.objetivo ?? null,
                    tareas: row.tareas ?? null,
                    observaciones: row.observaciones ?? null,
                    reqRegularizadas: row.regularizadas ?? null,
                    reqAprobadas: row.aprobadas ?? null,
                    reqOtros: row.otros ?? null,
                    estado: client_1.EstadoPropuesta.PUBLICADA,
                    convocatoriaId,
                },
            });
            created.push(prop);
        }
        return { importadas: created.length };
    }
};
exports.PropuestasService = PropuestasService;
exports.PropuestasService = PropuestasService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PropuestasService);
//# sourceMappingURL=propuestas.service.js.map