import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PadronService } from '../padron/padron.service';
import { EstadoConvocatoria } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { parsearPreferencias, verificarFila, FilaInscripcion, ErrorFila } from './planilla-verifier';

export interface ResultadoImportacion {
  cargaId: string;
  filasTotal: number;
  filasValidas: number;
  filasError: number;
  filasConAdvertencias: number;
  filasRequierenConfirmacion: number;
  errores: ErrorFila[];
  advertencias: ErrorFila[];
  confirmacionesPendientes: { fila: number; mensaje: string; dni: string }[];
}

@Injectable()
export class ImportacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly padronService: PadronService,
  ) {}

  async cargarPlanilla(
    convocatoriaId: string,
    file: Express.Multer.File,
  ): Promise<ResultadoImportacion> {
    // RN-02: bloquear si la convocatoria no está abierta
    const conv = await this.prisma.convocatoria.findUnique({ where: { id: convocatoriaId } });
    if (!conv) throw new ConflictException('Convocatoria no encontrada');
    if (conv.estado !== EstadoConvocatoria.ABIERTA) {
      fs.unlinkSync(file.path);
      throw new ConflictException(`No se puede cargar planilla: la convocatoria está en estado ${conv.estado} (RN-02)`);
    }

    // Crear registro de carga
    const carga = await this.prisma.cargaPlanilla.create({
      data: {
        convocatoriaId,
        filename: file.originalname,
        storagePath: file.path,
        estado: 'PROCESANDO',
        vigente: false,
      },
    });

    const todosErrores: ErrorFila[] = [];
    const todasAdvertencias: ErrorFila[] = [];
    const confirmaciones: { fila: number; mensaje: string; dni: string }[] = [];
    let filasTotal = 0;
    let filasValidas = 0;
    let filasError = 0;
    let filasAdvertencia = 0;

    // Leer planilla completa en memoria (heap ampliado a 4GB en package.json)
    const workbook = new ExcelJS.Workbook();
    if (file.originalname.toLowerCase().endsWith('.csv')) {
      await workbook.csv.readFile(file.path);
    } else {
      await workbook.xlsx.readFile(file.path);
    }
    const ws = workbook.worksheets[0];

    let headers: string[] = [];
    const porEstudiante = new Map<string, { fila: FilaInscripcion; rowIndex: number }>();

    ws.eachRow((row, idx) => {
      if (idx === 1) {
        row.eachCell((cell) => headers.push(String(cell.value ?? '').trim()));
        return;
      }
      filasTotal++;

      const raw: any = {};
      row.eachCell((cell, col) => { raw[headers[col - 1]] = cell.value; });

      // Buscar DNI en distintas variantes de nombre de columna
      const rawDni = raw['DNI'] ?? raw['Nro Documento'] ?? raw['Nº Documento'] ?? raw['Documento'] ?? raw['Nro. Documento'] ?? raw['N°Documento'] ?? '';
      const dni = String(rawDni).replace(/\./g, '').trim();
      
      if (!dni || dni === 'undefined' || dni === 'null') { filasError++; return; }

      const parsedPrefs = parsearPreferencias(raw);
      const promedio = raw['Promedio'] ? parseFloat(String(raw['Promedio']).replace(',', '.')) : undefined;


      if (!porEstudiante.has(dni)) {
        porEstudiante.set(dni, {
          rowIndex: idx,
          fila: {
            dni,
            legajo:   String(raw['Legajo'] ?? raw['Legajo '] ?? '').trim(),
            nombre:   String(raw['Nombre'] ?? raw['Nombres'] ?? '').trim(),
            apellido: String(raw['Apellido'] ?? raw['Apellidos'] ?? '').trim(),
            email:    String(raw['Email'] ?? raw['E-mail'] ?? raw['Correo'] ?? '').trim(),
            carrera:  String(raw['Carrera'] ?? raw['Especialidad'] ?? '').trim(),
            promedio,
            aprobadas: raw['Arpobadas']          != null ? Number(raw['Arpobadas'])          : (raw['Aprobadas'] != null ? Number(raw['Aprobadas']) : undefined),
            cursadas:  raw['Cursadas']            != null ? Number(raw['Cursadas'])            : undefined,
            aplazos:   raw['Numero de Aplazos']   != null ? Number(raw['Numero de Aplazos'])   : (raw['Aplazos'] != null ? Number(raw['Aplazos']) : undefined),
            preferencias: parsedPrefs,
          },
        });
      } else {
        porEstudiante.get(dni)!.fila.preferencias.push(...parsedPrefs);
      }
    });

    // OPTIMIZACIÓN: Cargar todo el padrón y propuestas de la convocatoria en memoria
    const [allPadron, allPropuestas] = await Promise.all([
      this.prisma.padronAcademico.findMany({ where: { convocatoriaId } }),
      this.prisma.propuesta.findMany({ where: { convocatoriaId } })
    ]);
    const padronMap = new Map(allPadron.map(p => [p.dni, p]));
    const propuestaMap = new Map(allPropuestas.map(p => [p.idExterno, p]));

    const upsertOps: any[] = [];

    // Verificar cada estudiante
    for (const [dni, { fila, rowIndex }] of porEstudiante) {
      // Tomar máximo 5 preferencias ordenadas
      fila.preferencias = fila.preferencias
        .sort((a, b) => a.orden - b.orden)
        .slice(0, 5);

      const padronEntry = padronMap.get(dni) || null;
      const resultado = verificarFila(rowIndex, fila, padronEntry);

      todosErrores.push(...resultado.errores);
      todasAdvertencias.push(...resultado.advertencias);

      if (!resultado.valida) { filasError++; continue; }
      if (resultado.requiereConfirmacion) {
        const conf = resultado.advertencias.find(a => a.tipo === 'CONFIRMACION_REQUERIDA');
        if (conf) {
          confirmaciones.push({ fila: rowIndex, mensaje: conf.mensaje, dni });
          filasTotal--;
          continue; // No se procesa hasta que el operador confirme
        }
      }
      if (resultado.advertencias.length > 0) filasAdvertencia++;

      // Verificar IDs de propuestas existen
      let prefValidas = 0;
      for (const pref of fila.preferencias) {
        const propuesta = propuestaMap.get(pref.idPropuesta);
        if (!propuesta) {
          todosErrores.push({ fila: rowIndex, tipo: 'ERROR', campo: 'preferencias', mensaje: `ID de propuesta no existe: ${pref.idPropuesta}` });
          continue;
        }
        
        // Agregar a la cola de operaciones
        upsertOps.push(
          this.prisma.postulacion.upsert({
            where: { padronId_convocatoriaId_ordenPreferencia: { padronId: padronEntry!.id, convocatoriaId, ordenPreferencia: pref.orden } },
            create: { padronId: padronEntry!.id, propuestaId: propuesta.id, convocatoriaId, cargaPlanillaId: carga.id, ordenPreferencia: pref.orden },
            update: { propuestaId: propuesta.id, cargaPlanillaId: carga.id },
          })
        );
        prefValidas++;
      }
      if (prefValidas > 0) filasValidas++;
      else filasError++;
    }

    // Ejecutar todos los upserts en lotes concurrentes para evitar N+1
    const BATCH_SIZE = 500;
    for (let i = 0; i < upsertOps.length; i += BATCH_SIZE) {
      const chunk = upsertOps.slice(i, i + BATCH_SIZE);
      await Promise.all(chunk);
    }

    // Marcar esta carga como vigente, invalidar anteriores
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
          reporteErrores: todosErrores as any,
          reporteAdvertencias: todasAdvertencias as any,
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

  getCarga(id: string) {
    return this.prisma.cargaPlanilla.findUnique({ where: { id } });
  }

  listarCargas(convocatoriaId: string) {
    return this.prisma.cargaPlanilla.findMany({
      where: { convocatoriaId },
      orderBy: { createdAt: 'desc' },
    });
  }

  getInscripciones(convocatoriaId: string) {
    // Retorna todos los estudiantes del padron que tienen al menos una postulacion en esta convocatoria
    return this.prisma.padronAcademico.findMany({
      where: {
        convocatoriaId,
        postulaciones: { some: { convocatoriaId } }
      },
      include: {
        postulaciones: {
          where: { convocatoriaId },
          orderBy: { ordenPreferencia: 'asc' },
          include: { propuesta: true }
        }
      },
      orderBy: { nombreCompleto: 'asc' }
    });
  }
}
