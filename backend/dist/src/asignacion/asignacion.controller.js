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
exports.AsignacionController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const asignacion_engine_service_1 = require("./asignacion-engine.service");
let AsignacionController = class AsignacionController {
    constructor(engine) {
        this.engine = engine;
    }
    ejecutar(convocatoriaId) {
        return this.engine.ejecutar(convocatoriaId);
    }
    getResultados(convocatoriaId, page = 1, limit = 50) {
        return this.engine.getResultados(convocatoriaId, +page, +limit);
    }
    getResultadoPorDni(convocatoriaId, dni) {
        return this.engine.getResultadoPorDni(convocatoriaId, dni);
    }
};
exports.AsignacionController = AsignacionController;
__decorate([
    (0, common_1.Post)('ejecutar'),
    (0, swagger_1.ApiOperation)({ summary: 'Ejecutar motor de asignación (RF-16 a RF-19)' }),
    __param(0, (0, common_1.Param)('convocatoriaId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AsignacionController.prototype, "ejecutar", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener resultados de asignación vigente' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false }),
    __param(0, (0, common_1.Param)('convocatoriaId')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], AsignacionController.prototype, "getResultados", null);
__decorate([
    (0, common_1.Get)('estudiante/:dni'),
    (0, swagger_1.ApiOperation)({
        summary: 'Consultar resultado de asignación por DNI (RF-19)',
    }),
    __param(0, (0, common_1.Param)('convocatoriaId')),
    __param(1, (0, common_1.Param)('dni')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AsignacionController.prototype, "getResultadoPorDni", null);
exports.AsignacionController = AsignacionController = __decorate([
    (0, swagger_1.ApiTags)('Asignación'),
    (0, common_1.Controller)('convocatorias/:convocatoriaId/asignacion'),
    __metadata("design:paramtypes", [asignacion_engine_service_1.AsignacionEngineService])
], AsignacionController);
//# sourceMappingURL=asignacion.controller.js.map