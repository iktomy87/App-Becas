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
const crypto_1 = require("crypto");
const planilla_verifier_1 = require("./planilla-verifier");
const UPSERT_CHUNK_SIZE = 3000;
let ImportacionService = class ImportacionService {
    constructor(prisma, padronService) {
        this.prisma = prisma;
        this.padronService = padronService;
    }
    async cargarPlanilla(convocatoriaId, file, onProgress) {
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
        let headers = [];
        const porEstudiante = new Map();
        const esCsv = file.originalname.toLowerCase().endsWith('.csv');
        if (esCsv) {
            await this.procesarCsvStreaming(file.path, (raw, idx, isHeaderRow) => {
                if (isHeaderRow) {
                    headers = raw;
                    return;
                }
                this.procesarFila(raw, idx, headers, porEstudiante, () => filasTotal++);
                if (onProgress && filasTotal % 5000 === 0)
                    onProgress(filasTotal);
            });
        }
        else {
            const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(file.path, {
                entries: 'emit',
                sharedStrings: 'cache',
                styles: 'ignore',
                hyperlinks: 'ignore',
                worksheets: 'emit',
            });
            for await (const worksheetReader of workbookReader) {
                for await (const row of worksheetReader) {
                    const idx = row.number;
                    if (idx === 1) {
                        const h = [];
                        row.eachCell((cell) => h.push(String(cell.value ?? '').trim()));
                        headers = h;
                        continue;
                    }
                    const raw = {};
                    row.eachCell((cell, col) => { raw[headers[col - 1]] = cell.value; });
                    this.procesarFila(raw, idx, headers, porEstudiante, () => filasTotal++);
                    if (onProgress && filasTotal % 5000 === 0)
                        onProgress(filasTotal);
                }
                break;
            }
        }
        const [allPadron, allPropuestas] = await Promise.all([
            this.prisma.padronAcademico.findMany({ where: { convocatoriaId } }),
            this.prisma.propuesta.findMany({ where: { convocatoriaId } }),
        ]);
        const padronMap = new Map(allPadron.map((p) => [p.dni, p]));
        const propuestaMap = new Map(allPropuestas.map((p) => [p.idExterno, p]));
        const filasPostulacion = [];
        for (const [dni, { fila, rowIndex }] of porEstudiante) {
            fila.preferencias = fila.preferencias.sort((a, b) => a.orden - b.orden).slice(0, 5);
            const padronEntry = padronMap.get(dni) || null;
            const resultado = (0, planilla_verifier_1.verificarFila)(rowIndex, fila, padronEntry);
            todosErrores.push(...resultado.errores);
            todasAdvertencias.push(...resultado.advertencias);
            if (!resultado.valida) {
                filasError++;
                continue;
            }
            if (resultado.requiereConfirmacion) {
                const conf = resultado.advertencias.find((a) => a.tipo === 'CONFIRMACION_REQUERIDA');
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
                const propuesta = propuestaMap.get(pref.idPropuesta);
                if (!propuesta) {
                    todosErrores.push({ fila: rowIndex, tipo: 'ERROR', campo: 'preferencias', mensaje: `ID de propuesta no existe: ${pref.idPropuesta}` });
                    continue;
                }
                filasPostulacion.push({
                    id: (0, crypto_1.randomUUID)(),
                    padronId: padronEntry.id,
                    propuestaId: propuesta.id,
                    convocatoriaId,
                    cargaPlanillaId: carga.id,
                    ordenPreferencia: pref.orden,
                });
                prefValidas++;
            }
            if (prefValidas > 0)
                filasValidas++;
            else
                filasError++;
        }
        await this.upsertPostulacionesBulk(filasPostulacion);
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
    procesarFila(raw, idx, headers, porEstudiante, contarFila) {
        contarFila();
        const rawDni = raw['DNI'] ?? raw['Nro Documento'] ?? raw['Nº Documento'] ?? raw['Documento'] ?? raw['Nro. Documento'] ?? raw['N°Documento'] ?? '';
        const dni = String(rawDni).replace(/\./g, '').trim();
        if (!dni || dni === 'undefined' || dni === 'null')
            return;
        const parsedPrefs = (0, planilla_verifier_1.parsearPreferencias)(raw);
        const promedio = raw['Promedio'] ? parseFloat(String(raw['Promedio']).replace(',', '.')) : undefined;
        if (!porEstudiante.has(dni)) {
            porEstudiante.set(dni, {
                rowIndex: idx,
                fila: {
                    dni,
                    legajo: String(raw['Legajo'] ?? raw['Legajo '] ?? '').trim(),
                    nombre: String(raw['Nombre'] ?? raw['Nombres'] ?? '').trim(),
                    apellido: String(raw['Apellido'] ?? raw['Apellidos'] ?? '').trim(),
                    email: String(raw['Email'] ?? raw['E-mail'] ?? raw['Correo'] ?? '').trim(),
                    carrera: String(raw['Carrera'] ?? raw['Especialidad'] ?? '').trim(),
                    promedio,
                    aprobadas: raw['Arpobadas'] != null ? Number(raw['Arpobadas']) : (raw['Aprobadas'] != null ? Number(raw['Aprobadas']) : undefined),
                    cursadas: raw['Cursadas'] != null ? Number(raw['Cursadas']) : undefined,
                    aplazos: raw['Numero de Aplazos'] != null ? Number(raw['Numero de Aplazos']) : (raw['Aplazos'] != null ? Number(raw['Aplazos']) : undefined),
                    preferencias: parsedPrefs,
                },
            });
        }
        else {
            porEstudiante.get(dni).fila.preferencias.push(...parsedPrefs);
        }
    }
    procesarCsvStreaming(filePath, onRow) {
        const csv = require('csv-parser');
        return new Promise((resolve, reject) => {
            let idx = 1;
            let headersSent = false;
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('headers', (headers) => {
                onRow(headers, idx, true);
                headersSent = true;
                idx++;
            })
                .on('data', (row) => {
                idx++;
                onRow(row, idx, false);
            })
                .on('end', () => resolve())
                .on('error', reject);
        });
    }
    async upsertPostulacionesBulk(filas) {
        for (let i = 0; i < filas.length; i += UPSERT_CHUNK_SIZE) {
            const chunk = filas.slice(i, i + UPSERT_CHUNK_SIZE);
            const ids = chunk.map((f) => f.id);
            const padronIds = chunk.map((f) => f.padronId);
            const propuestaIds = chunk.map((f) => f.propuestaId);
            const convocatoriaIds = chunk.map((f) => f.convocatoriaId);
            const cargaIds = chunk.map((f) => f.cargaPlanillaId);
            const ordenes = chunk.map((f) => f.ordenPreferencia);
            await this.prisma.$executeRaw `
        INSERT INTO postulaciones (id, padron_id, propuesta_id, convocatoria_id, carga_planilla_id, orden_preferencia)
        SELECT * FROM unnest(
          ${ids}::text[],
          ${padronIds}::text[],
          ${propuestaIds}::text[],
          ${convocatoriaIds}::text[],
          ${cargaIds}::text[],
          ${ordenes}::int[]
        )
        ON CONFLICT (padron_id, convocatoria_id, orden_preferencia)
        DO UPDATE SET
          propuesta_id = EXCLUDED.propuesta_id,
          carga_planilla_id = EXCLUDED.carga_planilla_id
      `;
        }
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
    getInscripciones(convocatoriaId) {
        return this.prisma.padronAcademico.findMany({
            where: {
                convocatoriaId,
                postulaciones: { some: { convocatoriaId } },
            },
            include: {
                postulaciones: {
                    where: { convocatoriaId },
                    orderBy: { ordenPreferencia: 'asc' },
                    include: { propuesta: true },
                },
            },
            orderBy: { nombreCompleto: 'asc' },
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