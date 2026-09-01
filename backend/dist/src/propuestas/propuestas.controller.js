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
exports.PropuestasController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const multer_1 = require("multer");
const path_1 = require("path");
const ExcelJS = require("exceljs");
const propuestas_service_1 = require("./propuestas.service");
const propuesta_dto_1 = require("./dto/propuesta.dto");
let PropuestasController = class PropuestasController {
    constructor(service) {
        this.service = service;
    }
    findAll(convocatoriaId) {
        return this.service.findAll(convocatoriaId);
    }
    findOne(id) {
        return this.service.findOne(id);
    }
    create(dto) {
        return this.service.create(dto);
    }
    publicar(id) {
        return this.service.publicar(id);
    }
    updateVacantes(id, dto) {
        return this.service.updateVacantes(id, dto);
    }
    async importarXls(file, convocatoriaId) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(file.path);
        const ws = workbook.worksheets[0];
        const rows = [];
        const headers = [];
        ws.eachRow((row, idx) => {
            if (idx === 1) {
                row.eachCell((cell) => headers.push(String(cell.value ?? '').trim()));
            }
            else {
                const obj = {};
                row.eachCell((cell, colNumber) => {
                    obj[headers[colNumber - 1]] = cell.value;
                });
                if (obj['numero'])
                    rows.push(obj);
            }
        });
        return this.service.importarDesdeXls(rows, convocatoriaId);
    }
};
exports.PropuestasController = PropuestasController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Listar propuestas (filtrar por convocatoria)' }),
    (0, swagger_1.ApiQuery)({ name: 'convocatoriaId', required: false }),
    __param(0, (0, common_1.Query)('convocatoriaId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PropuestasController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PropuestasController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Crear una propuesta manualmente' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [propuesta_dto_1.CreatePropuestaDto]),
    __metadata("design:returntype", void 0)
], PropuestasController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id/publicar'),
    (0, swagger_1.ApiOperation)({ summary: 'Publicar una propuesta (RF-02)' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PropuestasController.prototype, "publicar", null);
__decorate([
    (0, common_1.Put)(':id/vacantes'),
    (0, swagger_1.ApiOperation)({ summary: 'Actualizar cupo de vacantes (RF-03, RN-02)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, propuesta_dto_1.UpdateVacantesDto]),
    __metadata("design:returntype", void 0)
], PropuestasController.prototype, "updateVacantes", null);
__decorate([
    (0, common_1.Post)('importar-xls'),
    (0, swagger_1.ApiOperation)({ summary: 'Importar propuestas masivamente desde XLS de solicitudes' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: './uploads/propuestas',
            filename: (_req, file, cb) => cb(null, `${Date.now()}${(0, path_1.extname)(file.originalname)}`),
        }),
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Query)('convocatoriaId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PropuestasController.prototype, "importarXls", null);
exports.PropuestasController = PropuestasController = __decorate([
    (0, swagger_1.ApiTags)('Propuestas'),
    (0, common_1.Controller)('propuestas'),
    __metadata("design:paramtypes", [propuestas_service_1.PropuestasService])
], PropuestasController);
//# sourceMappingURL=propuestas.controller.js.map