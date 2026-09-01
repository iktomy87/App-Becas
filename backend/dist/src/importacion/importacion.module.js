"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportacionModule = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const importacion_controller_1 = require("./importacion.controller");
const importacion_service_1 = require("./importacion.service");
const padron_module_1 = require("../padron/padron.module");
let ImportacionModule = class ImportacionModule {
};
exports.ImportacionModule = ImportacionModule;
exports.ImportacionModule = ImportacionModule = __decorate([
    (0, common_1.Module)({
        imports: [
            platform_express_1.MulterModule.register({ dest: './uploads/planillas' }),
            padron_module_1.PadronModule,
        ],
        controllers: [importacion_controller_1.ImportacionController],
        providers: [importacion_service_1.ImportacionService],
        exports: [importacion_service_1.ImportacionService],
    })
], ImportacionModule);
//# sourceMappingURL=importacion.module.js.map