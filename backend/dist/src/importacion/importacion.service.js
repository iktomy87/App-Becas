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
exports.ImportacionService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const padron_service_1 = require("../padron/padron.service");
const client_1 = require("@prisma/client");
const ExcelJS = require("exceljs");
const fs = require("fs");
const planilla_verifier_1 = require("./planilla-verifier");
let ImportacionService = class ImportacionService {
    constructor(prisma, padronService) {
        this.prisma = prisma;
        this.padronService = padronService;
    }
    async cargarPlanilla(convocatoriaId, file) {
        const conv = await this.prisma.convocatoria.findUnique({ where: { id: convocatoriaId } });
        if (!conv)
            throw new common_1.ConflictException('Convocatoria no encontrada');
        if (conv.estado !== client_1.EstadoConvocatoria.ABIERTA) {
            fs.unlinkSync(file.path);
            throw new common_1.ConflictException(`No se puede cargar planilla: la convocatoria está en estado ${conv.estado} (RN-02)`);
        }
        const carga = await this.prisma.cargaPlanilla.create({
            data: {
                convocatoriaId,
                filename: file.originalname,
                storagePath: file.path,
                estado: 'PROCESANDO',
                vigente: false,
            },
        });
        const todosErrores = [];
        const todasAdvertencias = [];
        const confirmaciones = [];
        let filasTotal = 0;
        let filasValidas = 0;
        let filasError = 0;
        let filasAdvertencia = 0;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(file.path);
        const ws = workbook.worksheets[0];
        let headers = [];
        const porEstudiante = new Map();
        ws.eachRow((row, idx) => {
            if (idx === 1) {
                row.eachCell((cell) => headers.push(String(cell.value ?? '').trim()));
                return;
            }
            filasTotal++;
            const raw = {};
            row.eachCell((cell, col) => { raw[headers[col - 1]] = cell.value; });
            const dni = String(raw['DNI'] ?? '').replace(/\./g, '').trim();
            if (!dni) {
                filasError++;
                return;
            }
            const parsedPrefs = (0, planilla_verifier_1.parsearPreferencias)(raw);
            const promedio = raw['Promedio'] ? parseFloat(String(raw['Promedio']).replace(',', '.')) : undefined;
            if (!porEstudiante.has(dni)) {
                porEstudiante.set(dni, {
                    rowIndex: idx,
                    fila: {
                        dni,
                        legajo: String(raw['Legajo'] ?? '').trim(),
                        nombre: String(raw['Nombre'] ?? '').trim(),
                        apellido: String(raw['Apellido'] ?? '').trim(),
                        email: String(raw['Email'] ?? '').trim(),
                        carrera: String(raw['Carrera'] ?? '').trim(),
                        promedio,
                        aprobadas: raw['Arpobadas'] != null ? Number(raw['Arpobadas']) : undefined,
                        cursadas: raw['Cursadas'] != null ? Number(raw['Cursadas']) : undefined,
                        aplazos: raw['Numero de Aplazos'] != null ? Number(raw['Numero de Aplazos']) : undefined,
                        preferencias: parsedPrefs,
                    },
                });
            }
            else {
                const entry = porEstudiante.get(dni);
                entry.fila.preferencias.push(...parsedPrefs);
            }
        });
        for (const [dni, { fila, rowIndex }] of porEstudiante) {
            fila.preferencias = fila.preferencias
                .sort((a, b) => a.orden - b.orden)
                .slice(0, 5);
            const padronEntry = await this.padronService.findByDni(dni, convocatoriaId);
            const resultado = (0, planilla_verifier_1.verificarFila)(rowIndex, fila, padronEntry);
            todosErrores.push(...resultado.errores);
            todasAdvertencias.push(...resultado.advertencias);
            if (!resultado.valida) {
                filasError++;
                continue;
            }
            if (resultado.requiereConfirmacion) {
                const conf = resultado.advertencias.find(a => a.tipo === 'CONFIRMACION_REQUERIDA');
                if (conf) {
                    confirmaciones.push({ fila: rowIndex, mensaje: conf.mensaje, dni });
                    filasTotal--;
                    continue;
                }
            }
            if (resultado.advertencias.length > 0)
                filasAdvertencia++;
            let prefValidas = 0;
            for (const pref of fila.preferencias) {
                const propuesta = await this.prisma.propuesta.findFirst({
                    where: { idExterno: pref.idPropuesta, convocatoriaId },
                });
                if (!propuesta) {
                    todosErrores.push({ fila: rowIndex, tipo: 'ERROR', campo: 'preferencias', mensaje: `ID de propuesta no existe: ${pref.idPropuesta}` });
                    continue;
                }
                await this.prisma.postulacion.upsert({
                    where: { padronId_convocatoriaId_ordenPreferencia: { padronId: padronEntry.id, convocatoriaId, ordenPreferencia: pref.orden } },
                    create: { padronId: padronEntry.id, propuestaId: propuesta.id, convocatoriaId, cargaPlanillaId: carga.id, ordenPreferencia: pref.orden },
                    update: { propuestaId: propuesta.id, cargaPlanillaId: carga.id },
                });
                prefValidas++;
            }
            if (prefValidas > 0)
                filasValidas++;
            else
                filasError++;
        }
        await this.prisma.$transaction([
            this.prisma.cargaPlanilla.updateMany({ where: { convocatoriaId, vigente: true }, data: { vigente: false } }),
            this.prisma.cargaPlanilla.update({
                where: { id: carga.id },
                data: {
                    estado: 'COMPLETADA',
                    vigente: true,
                    filasTotal,
                    filasValidas,
                    filasError,
                    filasAdvertencia,
                    reporteErrores: todosErrores,
                    reporteAdvertencias: todasAdvertencias,
                },
            }),
        ]);
        return {
            cargaId: carga.id,
            filasTotal,
            filasValidas,
            filasError,
            filasConAdvertencias: filasAdvertencia,
            filasRequierenConfirmacion: confirmaciones.length,
            errores: todosErrores,
            advertencias: todasAdvertencias,
            confirmacionesPendientes: confirmaciones,
        };
    }
    getCarga(id) {
        return this.prisma.cargaPlanilla.findUnique({ where: { id } });
    }
    listarCargas(convocatoriaId) {
        return this.prisma.cargaPlanilla.findMany({
            where: { convocatoriaId },
            orderBy: { createdAt: 'desc' },
        });
    }
};
exports.ImportacionService = ImportacionService;
exports.ImportacionService = ImportacionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        padron_service_1.PadronService])
], ImportacionService);
//# sourceMappingURL=importacion.service.js.map