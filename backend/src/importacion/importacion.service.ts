import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PadronService } from '../padron/padron.service';
import { persistirAplazosDePlanilla } from '../padron/persistir-aplazos';
import { EstadoConvocatoria } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import {
  parsearPreferencias,
  verificarFila,
  FilaInscripcion,
  ErrorFila,
} from './planilla-verifier';
import { leerNumero, leerEntero, leerDni } from '../common/numero';
import { nombreEspecialidad } from '../especialidades/especialidades';
import { ArchivoPlanilla } from './archivo-planilla.interface';

export interface ResultadoImportacion {
  cargaId: string;
  filasTotal: number;
  filasValidas: number;
  filasError: number;
  filasConAdvertencias: number;
  /**
   * Cuántas filas del padrón quedaron con el `aplazos` que trajo esta planilla.
   *
   * Es 0 siempre que el archivo no tenga columna de aplazos, y también cuando
   * lo que llegó coincide con lo que ya estaba —no se escribe por escribir—. Si
   * esperabas que se actualizara y vuelve 0, el archivo no trae la columna o el
   * backend no está corriendo esta versión.
   */
  aplazosPersistidos: number;
  errores: ErrorFila[];
  advertencias: ErrorFila[];
}

const UPSERT_CHUNK_SIZE = 3000; // filas de "postulaciones" por statement unnest()

/**
 * Un estudiante en curso de lectura, con todas las filas del archivo en las que
 * aparece. Con el formato de una fila por preferencia de RN-01 un mismo DNI
 * ocupa hasta 5 filas, y sus preferencias se fusionan.
 */
interface EstudianteEnCurso {
  filas: number[];
  fila: FilaInscripcion;
}

/** Contadores y reporte que `procesarFila` actualiza durante la lectura. */
interface ContextoLectura {
  contarFila: () => void;
  error: (fila: number, campo: string, mensaje: string) => void;
  advertencia: (
    dni: string,
    fila: number,
    campo: string,
    mensaje: string,
  ) => void;
}

/**
 * Campos que se contrastan cuando un mismo DNI aparece en más de una fila. Los
 * academicométricos van primero porque son los que alimentan el puntaje: si dos
 * filas del mismo alumno los difieren, el archivo es contradictorio y hay que
 * elegir uno de forma explícita y auditable.
 */
const CAMPOS_A_COMPARAR: { campo: keyof FilaInscripcion; etiqueta: string }[] =
  [
    { campo: 'promedio', etiqueta: 'Promedio' },
    { campo: 'aprobadas', etiqueta: 'Aprobadas' },
    { campo: 'cursadas', etiqueta: 'Cursadas' },
    { campo: 'aplazos', etiqueta: 'Aplazos' },
    { campo: 'legajo', etiqueta: 'Legajo' },
    { campo: 'carrera', etiqueta: 'Carrera' },
    { campo: 'email', etiqueta: 'Email' },
    { campo: 'nombre', etiqueta: 'Nombre' },
    { campo: 'apellido', etiqueta: 'Apellido' },
  ];

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
    const conv = await this.prisma.convocatoria.findUnique({
      where: { id: convocatoriaId },
    });
    if (!conv) throw new ConflictException('Convocatoria no encontrada');
    if (conv.estado !== EstadoConvocatoria.ABIERTA) {
      fs.unlinkSync(file.path);
      throw new ConflictException(
        `No se puede cargar planilla: la convocatoria está en estado ${conv.estado} (RN-02)`,
      );
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
    let filasTotal = 0;
    let filasValidas = 0;
    let filasError = 0;
    let filasAdvertencia = 0;

    // `filasTotal` cuenta filas de datos del archivo; `filasValidas` y
    // `filasError` cuentan estudiantes. Sólo coinciden cuando cada estudiante
    // ocupa exactamente una fila (el formato del CSV de orden de mérito); con el
    // formato de una fila por preferencia de RN-01, la diferencia es la cantidad
    // de filas que se fusionaron, que queda avisada en `advertencias`.
    const dnisConAdvertencia = new Set<string>();
    const ctx: ContextoLectura = {
      contarFila: () => filasTotal++,
      // Un error de una celda no siempre invalida la fila: una preferencia
      // ilegible se reporta sin rechazar al estudiante, siempre que tenga
      // alguna preference legible. Por eso estos NO suman a `filasError`;
      // ese contador mide filas rechazadas, no entradas del reporte.
      error: (fila, campo, mensaje) =>
        todosErrores.push({ fila, tipo: 'ERROR', campo, mensaje }),
      advertencia: (dni, fila, campo, mensaje) => {
        todasAdvertencias.push({ fila, tipo: 'ADVERTENCIA', campo, mensaje });
        dnisConAdvertencia.add(dni);
      },
    };

    // ── 1) LECTURA EN STREAMING (antes: workbook.xlsx.readFile del archivo completo) ──
    // Esto es el cambio que más impacta con archivos de 2GB: nunca tenemos
    // el workbook entero en memoria, solo la fila que estamos procesando.
    let headers: string[] = [];
    const porEstudiante = new Map<string, EstudianteEnCurso>();

    const esCsv = file.originalname.toLowerCase().endsWith('.csv');

    if (esCsv) {
      // Para CSV, saltar ExcelJS por completo: csv-parser en streaming real
      // es más liviano que hacer pasar un CSV por el parser de ExcelJS.
      await this.procesarCsvStreaming(file.path, (raw, idx, isHeaderRow) => {
        if (isHeaderRow) {
          headers = raw as unknown as string[];
          return;
        }
        this.procesarFila(raw, idx, porEstudiante, ctx);
        if (onProgress && filasTotal % 5000 === 0) onProgress(filasTotal);
      });
    } else {
      const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(file.path, {
        entries: 'emit',
        sharedStrings: 'cache', // si el archivo tiene MUCHÍSIMOS strings únicos, evaluar 'emit'
        styles: 'ignore', // ignorar estilos acelera bastante el parseo
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
          row.eachCell((cell, col) => {
            raw[headers[col - 1]] = cell.value;
          });
          this.procesarFila(raw, idx, porEstudiante, ctx);
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
    console.log(
      '[DEBUG importación] Estudiantes parseados:',
      porEstudiante.size,
    );
    const sampleDnis = [...porEstudiante.keys()].slice(0, 5);
    console.log('[DEBUG importación] Primeros DNIs del archivo:', sampleDnis);
    console.log('[DEBUG importación] Registros en padrón:', allPadron.length);
    const samplePadronDnis = [...padronMap.keys()].slice(0, 5);
    console.log(
      '[DEBUG importación] Primeros DNIs del padrón:',
      samplePadronDnis,
    );
    console.log('[DEBUG importación] Propuestas:', allPropuestas.length);
    for (const d of sampleDnis) {
      console.log(
        `[DEBUG importación] DNI "${d}" en padrón? ${padronMap.has(d)}`,
      );
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
    const missingIds = [...allPrefIds].filter((id) => !propuestaMap.has(id));
    if (missingIds.length > 0) {
      console.log(
        `[importación] Auto-creando ${missingIds.length} propuestas desde las preferencias del archivo...`,
      );
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

    /**
     * `aplazos` resueltos que hay que dejar escritos en el padrón. Se anota
     * acá y se escribe una sola vez después del loop, para no meter un `update`
     * dentro de la iteración.
     */
    const aplazosResueltos: { padronId: string; aplazos: number }[] = [];

    for (const [dni, { fila, filas }] of porEstudiante) {
      // Se reportan todas las filas del estudiante: si llegó fusionado desde
      // varias, el operador tiene que saber cuáles son.
      const rowIndex = filas[0];
      fila.preferencias = fila.preferencias
        .sort((a, b) => a.orden - b.orden)
        .slice(0, 5);

      const padronEntry = padronMap.get(dni) || null;
      const resultado = verificarFila(rowIndex, fila, padronEntry);

      todosErrores.push(...resultado.errores);
      todasAdvertencias.push(...resultado.advertencias);

      if (!resultado.valida) {
        filasError++;
        continue;
      }
      if (resultado.advertencias.length > 0 || dnisConAdvertencia.has(dni))
        filasAdvertencia++;

      // El maestro no trae columna de aplazos, así que la fila del padrón los
      // tiene en 0 (o en el `Cant.` de una importación vieja) y la pantalla de
      // inscripciones muestra eso. El dato real viene en esta planilla y ya
      // está resuelto en `datos` —misma regla de prioridad que el puntaje—, así
      // que se deja escrito acá. Antes se parseaba y se descartaba: era la
      // única razón por la que la columna "Aplazos" no cuadraba con lo que
      // se puntúa.
      if (padronEntry && padronEntry.aplazos !== resultado.datos.aplazos) {
        aplazosResueltos.push({
          padronId: padronEntry.id,
          aplazos: resultado.datos.aplazos,
        });
      }

      let prefValidas = 0;
      for (const pref of fila.preferencias) {
        const propuesta = propuestaMap.get(pref.idPropuesta);
        if (!propuesta) {
          todosErrores.push({
            fila: rowIndex,
            tipo: 'ERROR',
            campo: 'preferencias',
            mensaje: `ID de propuesta no existe: ${pref.idPropuesta}`,
          });
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

    // Los aplazos van en el padrón, no en la postulación: la pantalla de
    // inscripciones los lee de ahí. Es la misma escritura que hace
    // `importarRanking`, y comparte sus dos salvedades —el orden de las cargas y
    // que sólo se escribe `aplazos`, nunca los campos donde el padrón manda.
    const aplazosPersistidos = await persistirAplazosDePlanilla(
      this.prisma,
      aplazosResueltos,
    );

    await this.prisma.$transaction([
      this.prisma.cargaPlanilla.updateMany({
        where: { convocatoriaId, vigente: true },
        data: { vigente: false },
      }),
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
      /**
       * Cuántas filas del padrón quedaron con el `aplazos` de esta planilla. Si
       * es 0 y esperabas que lo actualizara, o el archivo no trae la columna o
       * el backend no está corriendo esta versión.
       */
      aplazosPersistidos,
      errores: todosErrores,
      advertencias: todasAdvertencias,
    };
  }

  // Extrae la lógica de armado de FilaInscripcion (idéntica al original) para reusarla
  // tanto en el branch de streaming XLSX como en el de CSV.
  private procesarFila(
    raw: any,
    idx: number,
    porEstudiante: Map<string, EstudianteEnCurso>,
    ctx: ContextoLectura,
  ) {
    ctx.contarFila();

    const rawDni =
      raw['DNI'] ??
      raw['Nro Documento'] ??
      raw['Nº Documento'] ??
      raw['Documento'] ??
      raw['Nro. Documento'] ??
      raw['N°Documento'] ??
      '';
    // `leerDni` deja sólo dígitos, así que "46.464.433" → "46464433" y los
    // literales "undefined"/"null" quedan en cadena vacía sin necesidad de un
    // chequeo aparte para cada uno.
    const dni = leerDni(rawDni);

    if (!dni) {
      // Se reportaba en silencio: la fila ya había sumando a `filasTotal` pero
      // no caía en ningún bucket, así que el operador no se enteraba de que
      // existía. RF-07 exige reportar fila por fila.
      ctx.error(
        idx,
        'dni',
        `Fila sin DNI legible (valor recibido: "${String(rawDni).trim() || 'vacío'}") — la fila se descarta.`,
      );
      return;
    }

    const { preferencias, invalidas } = parsearPreferencias(raw);
    // Antes: `parseFloat(String(v).replace(',', '.'))`, que con "1.234,56"
    // devolvía 1 (parseFloat corta en el segundo punto). Se conserva el chequeo
    // por truthiness para que un Promedio vacío siga siendo `undefined` y no 0.
    const promedio = raw['Promedio'] ? leerNumero(raw['Promedio']) : undefined;

    for (const inv of invalidas) {
      // No invalida la fila: si alguna preferencia de la misma fila sí se
      // pudo leer, la fila se importa con las que sirven. Se reporta igual
      // porque la preferencia perdida no se puede recuperar de otro lado.
      ctx.error(
        idx,
        'preferencias',
        `Columna "${inv.columna}" ilegible — ${inv.motivo} (valor: "${inv.valor}")`,
      );
    }

    const nueva: FilaInscripcion = {
      dni,
      legajo: String(raw['Legajo'] ?? raw['Legajo '] ?? '').trim(),
      nombre: String(raw['Nombre'] ?? raw['Nombres'] ?? '').trim(),
      apellido: String(raw['Apellido'] ?? raw['Apellidos'] ?? '').trim(),
      email: String(
        raw['Email'] ?? raw['E-mail'] ?? raw['Correo'] ?? '',
      ).trim(),
      carrera: String(raw['Carrera'] ?? raw['Especialidad'] ?? '').trim(),
      promedio,
      // Conteos: enteros por naturaleza. Una celda vacía da 0, que es lo que
      // pasaba antes con `Number('')`, así que el comportamiento no cambia.
      aprobadas:
        raw['Arpobadas'] != null
          ? leerEntero(raw['Arpobadas'])
          : raw['Aprobadas'] != null
            ? leerEntero(raw['Aprobadas'])
            : undefined,
      cursadas:
        raw['Cursadas'] != null ? leerEntero(raw['Cursadas']) : undefined,
      aplazos:
        raw['Numero de Aplazos'] != null
          ? leerEntero(raw['Numero de Aplazos'])
          : raw['Aplazos'] != null
            ? leerEntero(raw['Aplazos'])
            : undefined,
      preferencias,
    };

    const previo = porEstudiante.get(dni);
    if (!previo) {
      porEstudiante.set(dni, { filas: [idx], fila: nueva });
      return;
    }

    // El mismo DNI en más de una fila: se fusionan las preferencias, que es lo
    // que espera el formato de una fila por preferencia de RN-01. Se avisa para
    // que la duplicación sea visible en vez de pasar desapercibida.
    const primeraFila = previo.filas[0];
    previo.filas.push(idx);

    // La fusión NO puede fabricar un error de validación. Si las dos filas
    // declaran la misma prioridad, la segunda Preference es la misma
    // postulación repetida, no una preferencia en conflicto: sin este filtro,
    // `verificarFila` veía "orden duplicado" y rechazaba al estudiante entero
    // por un defecto del archivo, blaming a las preferencias en vez de al DNI
    // repetido.
    const ordenes = new Set(previo.fila.preferencias.map((p) => p.orden));
    const repetidas: number[] = [];
    const agregadas = preferencias.filter((p) => {
      if (ordenes.has(p.orden)) {
        repetidas.push(p.orden);
        return false;
      }
      ordenes.add(p.orden);
      return true;
    });
    previo.fila.preferencias.push(...agregadas);

    // Si las filas se contradicen, se dice cuál contradice a cuál y qué se
    // conserva. Sin esto el operador solo veía un "orden duplicado" y no
    // podía saber que el archivo tenía al mismo alumno con dos promedios.
    const diferencias = CAMPOS_A_COMPARAR.filter(({ campo }) => {
      const a = previo.fila[campo];
      const b = nueva[campo];
      return a !== undefined && b !== undefined && String(a) !== String(b);
    }).map(
      ({ campo, etiqueta }) =>
        `${etiqueta}: "${String(nueva[campo])}" (fila ${idx}) en lugar de ` +
        `"${String(previo.fila[campo])}" (fila ${primeraFila})`,
    );

    const detalles: string[] = [];
    if (diferencias.length > 0) {
      // Se conservan los valores de la primera fila; es arbitrario, pero
      // explícito y auditable desde el reporte.
      detalles.push(
        `se conservaron los de la fila ${primeraFila} — ${diferencias.join('; ')}`,
      );
    }
    if (repetidas.length > 0) {
      detalles.push(
        `prioridad ${repetidas.join(' y ')} repetida en ambas filas, ` +
          `se contó una sola vez`,
      );
    }

    ctx.advertencia(
      dni,
      primeraFila,
      'dni',
      `El DNI ${dni} aparece en ${previo.filas.length} filas del archivo ` +
        `(${previo.filas.join(', ')})` +
        (detalles.length > 0
          ? ` — ${detalles.join('. ')}`
          : ' — se fusionaron sus preferencias'),
    );
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
      // `idx` es el número de línea físico del archivo, que es lo que el
      // operador necesita para encontrar la fila. Antes el header hacía un
      // `idx++` y el primer `data` otro, así que la primera fila de datos se
      // reportaba como línea 3 siendo la 2, y todas las siguientes iban
      // corridas en uno.
      let idx = 1;
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('headers', (headers: string[]) => onRow(headers, idx, true))
        .on('data', (row: any) => onRow(row, ++idx, false))
        .on('end', () => resolve())
        .on('error', reject);
    });
  }

  // Reemplaza el bucle de upsertOps + Promise.all por lotes con statements
  // unnest() de Postgres: cada llamada hace UN round-trip por hasta
  // UPSERT_CHUNK_SIZE filas, en vez de un upsert() de Prisma por fila.
  private async upsertPostulacionesBulk(
    filas: {
      id: string;
      padronId: string;
      propuestaId: string;
      convocatoriaId: string;
      cargaPlanillaId: string;
      ordenPreferencia: number;
    }[],
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

  async getInscripciones(convocatoriaId: string, page = 1, limit = 50) {
    // Misma forma de paginación que `getRanking`: `{data, total, page, limit}`.
    // Antes devolvía la lista completa; con 188+ filas por convocatoria seguía
    // alcanzando, pero no escala ni permite que la pantalla no cargue todo.
    const where = {
      convocatoriaId,
      postulaciones: { some: { convocatoriaId } },
    };
    const [data, total] = await Promise.all([
      this.prisma.padronAcademico.findMany({
        where,
        include: {
          postulaciones: {
            where: { convocatoriaId },
            orderBy: { ordenPreferencia: 'asc' },
            include: { propuesta: true },
          },
        },
        orderBy: { nombreCompleto: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.padronAcademico.count({ where }),
    ]);

    // Se resuelve el nombre de la carrera acá para que el frontend no
    // mantenga su propio diccionario de especialidades.
    return {
      data: data.map((r) => ({
        ...r,
        especialidad: nombreEspecialidad(r.especialidadCodigo),
      })),
      total,
      page,
      limit,
    };
  }
}
