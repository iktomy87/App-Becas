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
exports.PadronService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ExcelJS = require("exceljs");
const HEADER_ROW = 6;
const COL_MAP = {
    'Esp.': 'especialidadCodigo',
    'Plan ': 'plan',
    'Plan': 'plan',
    'Legajo ': 'legajo',
    'Legajo': 'legajo',
    'Ingr.': 'anioIngreso',
    'N°Documento': 'dni',
    'Apellido y Nombres': 'nombreCompleto',
    'Regularizadas': 'regularizadas',
    'Cursando año actual': 'cursando',
    'Total Aprobadas': 'aprobadas',
    'Prom.c/Apl': 'promedio',
    'Estado': 'estado',
    'Cant. ': 'aplazos',
    'Cant.': 'aplazos',
};
let PadronService = class PadronService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findByDni(dni, convocatoriaId) {
        return this.prisma.padronAcademico.findUnique({
            where: { dni_convocatoriaId: { dni: String(dni).replace(/\./g, ''), convocatoriaId } },
        });
    }
    async findByLegajo(legajo, convocatoriaId) {
        return this.prisma.padronAcademico.findFirst({
            where: { legajo: String(legajo), convocatoriaId },
        });
    }
    async cargarMaestro(filePath, convocatoriaId) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        const ws = workbook.worksheets[0];
        let headers = [];
        let procesadas = 0;
        let errores = 0;
        const BATCH = 200;
        const batch = [];
        const flush = async () => {
            if (batch.length === 0)
                return;
            for (const row of batch) {
                try {
                    await this.prisma.padronAcademico.upsert({
                        where: { dni_convocatoriaId: { dni: row.dni, convocatoriaId } },
                        create: { ...row, convocatoriaId },
                        update: { ...row },
                    });
                    procesadas++;
                }
                catch {
                    errores++;
                }
            }
            batch.length = 0;
        };
        await new Promise((resolve, reject) => {
            ws.eachRow(async (row, rowIndex) => {
                if (rowIndex < HEADER_ROW)
                    return;
                if (rowIndex === HEADER_ROW) {
                    row.eachCell((cell) => headers.push(String(cell.value ?? '').trim()));
                    return;
                }
                const raw = {};
                row.eachCell((cell, colNumber) => {
                    const header = headers[colNumber - 1];
                    const field = COL_MAP[header];
                    if (field)
                        raw[field] = cell.value;
                });
                if (!raw.dni)
                    return;
                raw.dni = String(raw.dni).replace(/\./g, '').trim();
                if (!raw.dni || raw.dni === '0')
                    return;
                raw.legajo = String(raw.legajo ?? '').trim();
                raw.nombreCompleto = String(raw.nombreCompleto ?? '').trim();
                raw.especialidadCodigo = raw.especialidadCodigo ? Number(raw.especialidadCodigo) : null;
                raw.plan = raw.plan ? Number(raw.plan) : null;
                raw.anioIngreso = raw.anioIngreso ? Number(String(raw.anioIngreso).replace('.', '')) : null;
                raw.regularizadas = Number(raw.regularizadas) || 0;
                raw.cursando = Number(raw.cursando) || 0;
                raw.aprobadas = Number(raw.aprobadas) || 0;
                raw.promedio = parseFloat(String(raw.promedio ?? '0').replace(',', '.')) || 0;
                raw.aplazos = Number(raw.aplazos) || 0;
                raw.estado = String(raw.estado ?? 'Activo').trim();
                batch.push(raw);
                if (batch.length >= BATCH)
                    await flush();
            });
            ws.lastRow;
            flush().then(resolve).catch(reject);
        });
        await flush();
        return { procesadas, errores };
    }
};
exports.PadronService = PadronService;
exports.PadronService = PadronService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PadronService);
//# sourceMappingURL=padron.service.js.map