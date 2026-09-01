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
exports.CreateRankingConfigDto = exports.UpdateEstadoConvocatoriaDto = exports.UpdateConvocatoriaDto = exports.CreateConvocatoriaDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
class CreateConvocatoriaDto {
}
exports.CreateConvocatoriaDto = CreateConvocatoriaDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'BIS 2026 - 1er semestre' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateConvocatoriaDto.prototype, "nombre", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-01' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateConvocatoriaDto.prototype, "fechaApertura", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-06-30' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateConvocatoriaDto.prototype, "fechaCierre", void 0);
class UpdateConvocatoriaDto {
}
exports.UpdateConvocatoriaDto = UpdateConvocatoriaDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateConvocatoriaDto.prototype, "nombre", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UpdateConvocatoriaDto.prototype, "fechaApertura", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UpdateConvocatoriaDto.prototype, "fechaCierre", void 0);
class UpdateEstadoConvocatoriaDto {
}
exports.UpdateEstadoConvocatoriaDto = UpdateEstadoConvocatoriaDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.EstadoConvocatoria }),
    (0, class_validator_1.IsEnum)(client_1.EstadoConvocatoria),
    __metadata("design:type", String)
], UpdateEstadoConvocatoriaDto.prototype, "estado", void 0);
class CreateRankingConfigDto {
}
exports.CreateRankingConfigDto = CreateRankingConfigDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 3 }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateRankingConfigDto.prototype, "minMateriasCursando", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1 }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateRankingConfigDto.prototype, "minRegularizadas", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 'PROMEDIO', description: 'PROMEDIO | APROBADAS | ANTIGUEDAD' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateRankingConfigDto.prototype, "criterioDesempate", void 0);
//# sourceMappingURL=convocatoria.dto.js.map