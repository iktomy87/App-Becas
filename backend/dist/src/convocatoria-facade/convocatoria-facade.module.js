"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConvocatoriaFacadeModule = void 0;
const common_1 = require("@nestjs/common");
const convocatoria_facade_controller_1 = require("./convocatoria-facade.controller");
const convocatoria_facade_service_1 = require("./convocatoria-facade.service");
const convocatorias_module_1 = require("../convocatorias/convocatorias.module");
const ranking_module_1 = require("../ranking/ranking.module");
const asignacion_module_1 = require("../asignacion/asignacion.module");
let ConvocatoriaFacadeModule = class ConvocatoriaFacadeModule {
};
exports.ConvocatoriaFacadeModule = ConvocatoriaFacadeModule;
exports.ConvocatoriaFacadeModule = ConvocatoriaFacadeModule = __decorate([
    (0, common_1.Module)({
        imports: [convocatorias_module_1.ConvocatoriasModule, ranking_module_1.RankingModule, asignacion_module_1.AsignacionModule],
        controllers: [convocatoria_facade_controller_1.ConvocatoriaFacadeController],
        providers: [convocatoria_facade_service_1.ConvocatoriaFacadeService],
    })
], ConvocatoriaFacadeModule);
//# sourceMappingURL=convocatoria-facade.module.js.map