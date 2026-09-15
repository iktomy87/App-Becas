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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportacionController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const multer_1 = require("multer");
const path_1 = require("path");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const importacion_service_1 = require("./importacion.service");
const importacion_constants_1 = require("./importacion.constants");
let ImportacionController = class ImportacionController {
    constructor(importacionQueue, prisma, importacionService) {
        this.importacionQueue = importacionQueue;
        this.prisma = prisma;
        this.importacionService = importacionService;
    }
    async subirPlanilla(convocatoriaId, file) {
        if (!file)
            throw new common_1.BadRequestException('Falta el archivo');
        const conv = await this.prisma.convocatoria.findUnique({ where: { id: convocatoriaId } });
        if (!conv)
            throw new common_1.NotFoundException('Convocatoria no encontrada');
        if (conv.estado !== client_1.EstadoConvocatoria.ABIERTA) {
            throw new common_1.BadRequestException(`No se puede cargar planilla: la convocatoria está en estado ${conv.estado} (RN-02)`);
        }
        const job = await this.importacionQueue.add('cargar-planilla', {
            convocatoriaId,
            filePath: file.path,
            originalname: file.originalname,
        });
        return { jobId: job.id };
    }
    async getStatus(jobId) {
        const job = await this.importacionQueue.getJob(jobId);
        if (!job)
            throw new common_1.NotFoundException('Job no encontrado');
        const state = await job.getState();
        return {
            state,
            progress: job.progress,
            resultado: state === 'completed' ? job.returnvalue : undefined,
            error: state === 'failed' ? job.failedReason : undefined,
        };
    }
    listarPlanillas(convocatoriaId) {
        return this.importacionService.listarCargas(convocatoriaId);
    }
    async getPlanilla(cargaId) {
        const carga = await this.importacionService.getCarga(cargaId);
        if (!carga)
            throw new common_1.NotFoundException('Carga no encontrada');
        return carga;
    }
    getPadron(convocatoriaId) {
        return this.importacionService.getInscripciones(convocatoriaId);
    }
};
exports.ImportacionController = ImportacionController;
__decorate([
    (0, common_1.Post)(['planilla', 'planillas']),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: '/tmp/uploads',
            filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${(0, path_1.extname)(file.originalname)}`),
        }),
        limits: { fileSize: 3 * 1024 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.Param)('convocatoriaId')),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ImportacionController.prototype, "subirPlanilla", null);
__decorate([
    (0, common_1.Get)('planilla/status/:jobId'),
    __param(0, (0, common_1.Param)('jobId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ImportacionController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Get)('planillas'),
    __param(0, (0, common_1.Param)('convocatoriaId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ImportacionController.prototype, "listarPlanillas", null);
__decorate([
    (0, common_1.Get)('planillas/:cargaId'),
    __param(0, (0, common_1.Param)('cargaId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ImportacionController.prototype, "getPlanilla", null);
__decorate([
    (0, common_1.Get)('padron'),
    __param(0, (0, common_1.Param)('convocatoriaId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ImportacionController.prototype, "getPadron", null);
exports.ImportacionController = ImportacionController = __decorate([
    (0, common_1.Controller)('convocatorias/:convocatoriaId'),
    __param(0, (0, bullmq_1.InjectQueue)(importacion_constants_1.IMPORTACION_QUEUE)),
    __metadata("design:paramtypes", [bullmq_2.Queue,
        prisma_service_1.PrismaService,
        importacion_service_1.ImportacionService])
], ImportacionController);
//# sourceMappingURL=importacion.controller.js.map