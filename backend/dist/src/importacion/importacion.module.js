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
const bullmq_1 = require("@nestjs/bullmq");
const importacion_controller_1 = require("./importacion.controller");
const importacion_service_1 = require("./importacion.service");
const prisma_module_1 = require("../prisma/prisma.module");
const padron_module_1 = require("../padron/padron.module");
const importacion_constants_1 = require("./importacion.constants");
let ImportacionModule = class ImportacionModule {
};
exports.ImportacionModule = ImportacionModule;
exports.ImportacionModule = ImportacionModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            padron_module_1.PadronModule,
            bullmq_1.BullModule.registerQueue({ name: importacion_constants_1.IMPORTACION_QUEUE }),
        ],
        providers: [importacion_service_1.ImportacionService],
        controllers: [importacion_controller_1.ImportacionController],
    })
], ImportacionModule);
//# sourceMappingURL=importacion.module.js.map