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
exports.ReportesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");
let ReportesService = class ReportesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async generarReporteAsignacion(convocatoriaId) {
        const corrida = await this.prisma.corridaAsignacion.findFirst({
            where: { convocatoriaId, vigente: true },
            include: {
                resultados: {
                    include: {
                        padron: true,
                        propuesta: true,
                    },
                    orderBy: { estado: 'asc' },
                },
            },
        });
        if (!corrida)
            throw new Error('No hay corrida de asignación vigente para esta convocatoria');
        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Resultado Asignación');
        ws.addRow(['DNI', 'Legajo', 'Apellido y Nombre', 'Estado', 'Área Asignada', 'ID Propuesta', 'Preferencia Satisfecha']);
        ws.getRow(1).font = { bold: true };
        for (const r of corrida.resultados) {
            ws.addRow([
                r.padron.dni,
                r.padron.legajo,
                r.padron.nombreCompleto,
                r.estado,
                r.propuesta?.titulo ?? '-',
                r.propuesta?.idExterno ?? '-',
                r.preferenciaSatisfecha ?? '-',
            ]);
        }
        const dir = './uploads/reportes';
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        const filename = `reporte_asignacion_${convocatoriaId}_${Date.now()}.xlsx`;
        const filePath = path.join(dir, filename);
        await workbook.xlsx.writeFile(filePath);
        return filePath;
    }
};
exports.ReportesService = ReportesService;
exports.ReportesService = ReportesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReportesService);
//# sourceMappingURL=reportes.service.js.map