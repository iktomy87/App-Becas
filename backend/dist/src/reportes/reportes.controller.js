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
exports.ReportesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const reportes_service_1 = require("./reportes.service");
let ReportesController = class ReportesController {
    constructor(service) {
        this.service = service;
    }
    async descargarAsignacion(convocatoriaId, res) {
        const filePath = await this.service.generarReporteAsignacion(convocatoriaId);
        res.download(filePath, 'reporte_asignacion.xlsx');
    }
};
exports.ReportesController = ReportesController;
__decorate([
    (0, common_1.Get)('asignacion'),
    (0, swagger_1.ApiOperation)({ summary: 'Descargar reporte de asignación en Excel (RF-20)' }),
    __param(0, (0, common_1.Param)('convocatoriaId')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ReportesController.prototype, "descargarAsignacion", null);
exports.ReportesController = ReportesController = __decorate([
    (0, swagger_1.ApiTags)('Reportes'),
    (0, common_1.Controller)('convocatorias/:convocatoriaId/reportes'),
    __metadata("design:paramtypes", [reportes_service_1.ReportesService])
], ReportesController);
//# sourceMappingURL=reportes.controller.js.map