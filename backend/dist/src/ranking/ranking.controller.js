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
exports.RankingController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const ranking_service_1 = require("./ranking.service");
let RankingController = class RankingController {
    constructor(service) {
        this.service = service;
    }
    calcular(convocatoriaId) {
        return this.service.calcularRanking(convocatoriaId);
    }
    getRanking(convocatoriaId, page = 1, limit = 50) {
        return this.service.getRanking(convocatoriaId, +page, +limit);
    }
    getDesglose(convocatoriaId, dni) {
        return this.service.getDesglose(convocatoriaId, dni);
    }
};
exports.RankingController = RankingController;
__decorate([
    (0, common_1.Post)('calcular'),
    (0, swagger_1.ApiOperation)({ summary: 'Calcular ranking de la convocatoria (RF-12, RF-13)' }),
    __param(0, (0, common_1.Param)('convocatoriaId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RankingController.prototype, "calcular", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener ranking paginado (RF-13)' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    __param(0, (0, common_1.Param)('convocatoriaId')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], RankingController.prototype, "getRanking", null);
__decorate([
    (0, common_1.Get)('estudiante/:dni'),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener desglose de puntaje de un estudiante (RF-15)' }),
    __param(0, (0, common_1.Param)('convocatoriaId')),
    __param(1, (0, common_1.Param)('dni')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], RankingController.prototype, "getDesglose", null);
exports.RankingController = RankingController = __decorate([
    (0, swagger_1.ApiTags)('Ranking'),
    (0, common_1.Controller)('convocatorias/:convocatoriaId/ranking'),
    __metadata("design:paramtypes", [ranking_service_1.RankingService])
], RankingController);
//# sourceMappingURL=ranking.controller.js.map