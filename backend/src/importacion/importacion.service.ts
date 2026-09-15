import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PadronService } from '../padron/padron.service';
import { EstadoConvocatoria } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { parsearPreferencias, verificarFila, FilaInscripcion, ErrorFila } from './planilla-verifier';
import { ArchivoPlanilla } from './archivo-planilla.interface';

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

const UPSERT_CHUNK_SIZE = 3000; // filas de "postulaciones" por statement unnest()

@Injectable()
export class ImportacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly padronService: PadronService,
  ) {}

  async cargarPlanilla(
    convocatoriaId: string,
    file: ArchivoPlanilla,
    onProgress?: (rowsProcessed: number) => void,
  ): Promise<ResultadoImportacion> {
    // RN-02: bloquear si la convocatoria no está abierta
    const conv = await this.prisma.convocatoria.findUnique({ where: { id: convocatoriaId } });
    if (!conv) throw new ConflictException('Convocatoria no encontrada');
    if (conv.estado !== EstadoConvocatoria.ABIERTA) {
      fs.unlinkSync(file.path);
      throw new ConflictException(`No se puede cargar planilla: la convocatoria está en estado ${conv.estado} (RN-02)`);
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

    const todosErrores: ErrorFila[] = [];
    const todasAdvertencias: ErrorFila[] = [];
    const confirmaciones: { fila: number; mensaje: string; dni: string }[] = [];
    let filasTotal = 0;
    let filasValidas = 0;
    let filasError = 0;
    let filasAdvertencia = 0;

    // ── 1) LECTURA EN STREAMING (antes: workbook.xlsx.readFile del archivo completo) ──
    // Esto es el cambio que más impacta con archivos de 2GB: nunca tenemos
    // el workbook entero en memoria, solo la fila que estamos procesando.
    let headers: string[] = [];
    const porEstudiante = new Map<string, { fila: FilaInscripcion; rowIndex: number }>();

    const esCsv = file.originalname.toLowerCase().endsWith('.csv');

    if (esCsv) {
      // Para CSV, saltar ExcelJS por completo: csv-parser en streaming real
      // es más liviano que hacer pasar un CSV por el parser de ExcelJS.
      await this.procesarCsvStreaming(file.path, (raw, idx, isHeaderRow) => {
        if (isHeaderRow) { headers = raw as unknown as string[]; return; }
        this.procesarFila(raw, idx, headers, porEstudiante, () => filasTotal++);
        if (onProgress && filasTotal % 5000 === 0) onProgress(filasTotal);
      });
    } else {
      const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(file.path, {
        entries: 'emit',
        sharedStrings: 'cache', // si el archivo tiene MUCHÍSIMOS strings únicos, evaluar 'emit'
        styles: 'ignore',       // ignorar estilos acelera bastante el parseo
        hyperlinks: 'ignore',
        worksheets: 'emit',
      });

      for await (const worksheetReader of workbookReader) {
        for await (const row of worksheetReader) {
          const idx = row.number;
          if (idx === 1) {
            const h: string[] = [];
            row.eachCell((cell) => h.push(String(cell.value ?? '').trim()));
            headers = h;
            continue;
          }
          const raw: any = {};
          row.eachCell((cell, col) => { raw[headers[col - 1]] = cell.value; });
          this.procesarFila(raw, idx, headers, porEstudiante, () => filasTotal++);
          if (onProgress && filasTotal % 5000 === 0) onProgress(filasTotal);
        }
        break; // solo la primera hoja, igual que el original (worksheets[0])
      }
    }

    // ── 2) Cargar padrón y propuestas de la convocatoria (igual que antes) ──
    const [allPadron, allPropuestas] = await Promise.all([
      this.prisma.padronAcademico.findMany({ where: { convocatoriaId } }),
      this.prisma.propuesta.findMany({ where: { convocatoriaId } }),
    ]);
    const padronMap = new Map(allPadron.map((p) => [p.dni, p]));
    const propuestaMap = new Map(allPropuestas.map((p) => [p.idExterno, p]));

    // Filas de postulación a insertar/actualizar en batch (unnest), en vez de
    // un upsert() de Prisma por cada preferencia.
    type FilaPostulacion = {
      id: string;
      padronId: string;
      propuestaId: string;
      convocatoriaId: string;
      cargaPlanillaId: string;
      ordenPreferencia: number;
    };
    const filasPostulacion: FilaPostulacion[] = [];

    // ── DEBUG: log para diagnosticar por qué fallan todas las filas ──
    console.log('[DEBUG importación] Headers leídos:', headers);
    console.log('[DEBUG importación] Estudiantes parseados:', porEstudiante.size);
    const sampleDnis = [...porEstudiante.keys()].slice(0, 5);
    console.log('[DEBUG importación] Primeros DNIs del archivo:', sampleDnis);
    console.log('[DEBUG importación] Registros en padrón:', allPadron.length);
    const samplePadronDnis = [...padronMap.keys()].slice(0, 5);
    console.log('[DEBUG importación] Primeros DNIs del padrón:', samplePadronDnis);
    console.log('[DEBUG importación] Propuestas:', allPropuestas.length);
    for (const d of sampleDnis) {
      console.log(`[DEBUG importación] DNI "${d}" en padrón? ${padronMap.has(d)}`);
    }

    // ── 2b) Auto-crear propuestas que no existan ──
    // Recopilar todos los idPropuesta únicos que aparecen en las preferencias
    const allPrefIds = new Set<string>();
    for (const { fila } of porEstudiante.values()) {
      for (const pref of fila.preferencias) {
        if (pref.idPropuesta) allPrefIds.add(pref.idPropuesta);
      }
    }
    // Crear las que falten
    const missingIds = [...allPrefIds].filter(id => !propuestaMap.has(id));
    if (missingIds.length > 0) {
      console.log(`[importación] Auto-creando ${missingIds.length} propuestas desde las preferencias del archivo...`);
      for (const idExterno of missingIds) {
        const created = await this.prisma.propuesta.create({
          data: {
            idExterno,
            titulo: `Propuesta ${idExterno}`,
            tipo: 'SERVICIO',
            responsableNombre: 'Por definir',
            responsableEmail: 'por-definir@ejemplo.com',
            vacantesTotal: 1,
            vacantesDisponibles: 1,
            convocatoriaId,
          },
        });
        propuestaMap.set(idExterno, created);
      }
      console.log(`[importación] ${missingIds.length} propuestas creadas.`);
    }

    for (const [dni, { fila, rowIndex }] of porEstudiante) {
      fila.preferencias = fila.preferencias.sort((a, b) => a.orden - b.orden).slice(0, 5);

      const padronEntry = padronMap.get(dni) || null;
      const resultado = verificarFila(rowIndex, fila, padronEntry);

      todosErrores.push(...resultado.errores);
      todasAdvertencias.push(...resultado.advertencias);

      if (!resultado.valida) { filasError++; continue; }
      if (resultado.requiereConfirmacion) {
        const conf = resultado.advertencias.find((a) => a.tipo === 'CONFIRMACION_REQUERIDA');
        if (conf) {
          confirmaciones.push({ fila: rowIndex, mensaje: conf.mensaje, dni });
          filasTotal--;
          continue;
        }
      }
      if (resultado.advertencias.length > 0) filasAdvertencia++;

      let prefValidas = 0;
      for (const pref of fila.preferencias) {
        const propuesta = propuestaMap.get(pref.idPropuesta);
        if (!propuesta) {
          todosErrores.push({ fila: rowIndex, tipo: 'ERROR', campo: 'preferencias', mensaje: `ID de propuesta no existe: ${pref.idPropuesta}` });
          continue;
        }
        filasPostulacion.push({
          id: randomUUID(),
          padronId: padronEntry!.id,
          propuestaId: propuesta.id,
          convocatoriaId,
          cargaPlanillaId: carga.id,
          ordenPreferencia: pref.orden,
        });
        prefValidas++;
      }
      if (prefValidas > 0) filasValidas++;
      else filasError++;
    }

    // ── 3) UPSERT MASIVO con unnest() en vez de N upserts individuales ──
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

  // Extrae la lógica de armado de FilaInscripcion (idéntica al original) para reusarla
  // tanto en el branch de streaming XLSX como en el de CSV.
  private procesarFila(
    raw: any,
    idx: number,
    headers: string[],
    porEstudiante: Map<string, { fila: FilaInscripcion; rowIndex: number }>,
    contarFila: () => void,
  ) {
    contarFila();

    const rawDni = raw['DNI'] ?? raw['Nro Documento'] ?? raw['Nº Documento'] ?? raw['Documento'] ?? raw['Nro. Documento'] ?? raw['N°Documento'] ?? '';
    const dni = String(rawDni).replace(/\./g, '').trim();
    if (!dni || dni === 'undefined' || dni === 'null') return;

    const parsedPrefs = parsearPreferencias(raw);
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
    } else {
      porEstudiante.get(dni)!.fila.preferencias.push(...parsedPrefs);
    }
  }

  private procesarCsvStreaming(
    filePath: string,
    onRow: (raw: any, idx: number, isHeaderRow: boolean) => void,
  ): Promise<void> {
    // Requiere `csv-parser` (npm i csv-parser). Streaming real línea por línea,
    // sin cargar el archivo completo en memoria.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const csv = require('csv-parser');
    return new Promise((resolve, reject) => {
      let idx = 1;
      let headersSent = false;
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('headers', (headers: string[]) => {
          onRow(headers, idx, true);
          headersSent = true;
          idx++;
        })
        .on('data', (row: any) => {
          idx++;
          onRow(row, idx, false);
        })
        .on('end', () => resolve())
        .on('error', reject);
    });
  }

  // Reemplaza el bucle de upsertOps + Promise.all por lotes con statements
  // unnest() de Postgres: cada llamada hace UN round-trip por hasta
  // UPSERT_CHUNK_SIZE filas, en vez de un upsert() de Prisma por fila.
  private async upsertPostulacionesBulk(
    filas: { id: string; padronId: string; propuestaId: string; convocatoriaId: string; cargaPlanillaId: string; ordenPreferencia: number }[],
  ) {
    for (let i = 0; i < filas.length; i += UPSERT_CHUNK_SIZE) {
      const chunk = filas.slice(i, i + UPSERT_CHUNK_SIZE);
      const ids = chunk.map((f) => f.id);
      const padronIds = chunk.map((f) => f.padronId);
      const propuestaIds = chunk.map((f) => f.propuestaId);
      const convocatoriaIds = chunk.map((f) => f.convocatoriaId);
      const cargaIds = chunk.map((f) => f.cargaPlanillaId);
      const ordenes = chunk.map((f) => f.ordenPreferencia);

      await this.prisma.$executeRaw`
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
}
