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
exports.PadronController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const multer_1 = require("multer");
const path_1 = require("path");
const padron_service_1 = require("./padron.service");
let PadronController = class PadronController {
    constructor(service) {
        this.service = service;
    }
    async cargar(convocatoriaId, file) {
        const result = await this.service.cargarMaestro(file.path, convocatoriaId);
        return { mensaje: 'Padrón cargado exitosamente', ...result };
    }
};
exports.PadronController = PadronController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Cargar maestro.xlsx como padrón académico de la convocatoria' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: './uploads/padron',
            filename: (_req, file, cb) => cb(null, `padron_${Date.now()}${(0, path_1.extname)(file.originalname)}`),
        }),
    })),
    __param(0, (0, common_1.Param)('convocatoriaId')),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PadronController.prototype, "cargar", null);
exports.PadronController = PadronController = __decorate([
    (0, swagger_1.ApiTags)('Padrón'),
    (0, common_1.Controller)('convocatorias/:convocatoriaId/padron'),
    __metadata("design:paramtypes", [padron_service_1.PadronService])
], PadronController);
//# sourceMappingURL=padron.controller.js.map