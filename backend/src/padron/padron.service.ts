import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { leerNumero, leerEntero, leerDni } from '../common/numero';
import * as fs from 'fs';
import * as readline from 'readline';

// El CSV del maestro tiene metadatos en filas 1-5; el header real está en la fila 6
const HEADER_ROW = 6;

/**
 * Mapeo de columnas del CSV a campos del modelo.
 *
 * La clave es el header **ya recortado** (`COL_MAP[header.trim()]` en
 * `parseRow`). Por eso no hay claves con espacio al final: un `trim()` jamás
 * devuelve una cadena que termine en espacio, así que una clave como `'Plan '`
 * o `'Legajo '` no puede consultarse nunca. Existían esas dos y se veían
 * razonables, pero eran código muerto: el padding con que Excel exporta el
 * maestro (`'Plan '`, `'Legajo '`, `'Estado   '`, `'N°Documento    '`) ya lo
 * resuelve el `trim()`, no un alias.
 *
 * Los aliases que sí valen la pena son los de una columna que el archivo
 * podría nombrar distinto, como `'Correo'`/`'E-mail'`. Un alias para una
 * variante de escritura que ya cubre el `trim()` sólo confunde.
 */
const COL_MAP: Record<string, string> = {
  'Esp.': 'especialidadCodigo',
  Plan: 'plan',
  Legajo: 'legajo',
  'Ingr.': 'anioIngreso',
  'N°Documento': 'dni',
  'Apellido y Nombres': 'nombreCompleto',
  Regularizadas: 'regularizadas',
  'Cursando año actual': 'cursando',
  // `aprobadas` sale de `Total Aprobadas`, NO de `Cant.`, aunque `Cant.` sea una
  // segunda columna de aprobadas más nueva (ver la nota al pie de este mapa):
  // queda 1 a 11 por debajo en el 17.8% de las filas, y no hay forma de saber
  // cuál de las dos es la oficial. Contra la planilla de orden de mérito de 2026
  // `Total Aprobadas` coincide algo más que `Cant.` (7.3% vs 4.0%), o sea que los
  // datos tampoco dan un veredicto. Se deja `Total Aprobadas` y se anota acá que
  // la decisión está tomada a propósito, no por desconocimiento de `Cant.`.
  'Total Aprobadas': 'aprobadas',
  'Prom.c/Apl': 'promedio',
  Estado: 'estado',
  // `Cant.` NO va a `aplazos`, que es lo importante de esta lista de descartes.
  // Antes se mapeaba y `PadronAcademico.aplazos` quedaba con ese valor: para el
  // DNI 42732664 (Brites, Agustín Ezequiel) daba 43 aplazos cuando la planilla
  // de orden de mérito dice 1, y la penalización 2/(1+aplazos) del puntaje salía
  // casi nula.
  //
  // No es un número de domicilio, que fue la hipótesis de entonces (está
  // después de `LOCALIDAD`). Medido sobre las 26.936 filas del maestro: `Cant.`
  // coincide con `Total Aprobadas` en el 92.8% y NUNCA es menor que ella —0 en
  // el 82.2%, de +1 a +11 en el resto—. Es una segunda columna de materias
  // aprobadas, más nueva. Como aplazos no sirve, y como sustituto de
  // `Total Aprobadas` tampoco está adoptionado: ver la nota de arriba.
  //
  // ATENCIÓN: la llave de búsqueda es `header.trim()` (línea 62), así que
  // agregar acá una clave con espacio final no hace nada. Si alguna vez hiciera
  // falta tolerar un nombre de columna nuevo, va con el nombre recortado.
};

const BATCH_SIZE = 100;

export function parseRow(headers: string[], values: string[]): any | null {
  const raw: any = {};
  headers.forEach((header, i) => {
    const field = COL_MAP[header.trim()];
    if (field) raw[field] = (values[i] ?? '').trim();
  });

  if (!raw.dni) return null;
  raw.dni = leerDni(raw.dni);
  if (!raw.dni || raw.dni === '0') return null;

  raw.legajo = String(raw.legajo ?? '').trim();
  raw.nombreCompleto = String(raw.nombreCompleto ?? '').trim();
  raw.especialidadCodigo = raw.especialidadCodigo
    ? leerEntero(raw.especialidadCodigo)
    : null;
  // OJO: `plan` es el CÓDIGO del plan de estudios, no la cantidad de materias.
  // En el maestro vale 95 para 13.666 alumnos, 2.003, 2.019, 99, 98… o sea
  // mezcla de números de plan y de años. Sirve para saber qué plan cursa el
  // alumno, NO como denominador de `cursadas × 3 / totalMateriasPlan`: el
  // total de materias sale del catálogo de especialidades o de la columna
  // `Mat. de la carrera` del archivo de orden de mérito. Confundir las dos
  // cosas da 95 en vez de 42 para ISI y arruina el puntaje.
  raw.plan = raw.plan ? leerEntero(raw.plan) : null;
  // `Ingr.` viene con punto de miles: "2.024" es el año 2024, no 2.024.
  raw.anioIngreso = raw.anioIngreso ? leerEntero(raw.anioIngreso) : null;
  raw.regularizadas = leerEntero(raw.regularizadas);
  raw.cursando = leerEntero(raw.cursando);
  raw.aprobadas = leerEntero(raw.aprobadas);
  // `Prom.c/Apl` viene en formato argentino: "7,88".
  raw.promedio = leerNumero(raw.promedio);
  raw.estado = String(raw.estado ?? 'Activo').trim();

  // El maestro no tiene columna de aplazos (ver la nota sobre `Cant.` en
  // `COL_MAP`), así que el valor no llega por el mapeo de columnas. Se emite
  // explícitamente en 0, y no se deja de emitir, porque `cargarMaestro` hace
  // `update: { ...row }`, y Prisma sólo pisa los campos presentes en el objeto:
  // omitirlo dejaría congelado el valor viejo de la fila. No es hipotético — hay
  // filas ya importadas con el `Cant.` de antes (43 para el 42732664), y sin este
  // 0 reimportar el padrón no las corregiría nunca.
  // El valor con significado es el de la planilla; ver `resolver-datos.ts`.
  raw.aplazos = 0;

  return raw;
}

// Parsea una línea de CSV respetando comillas
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

@Injectable()
export class PadronService {
  private readonly logger = new Logger(PadronService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByDni(dni: string, convocatoriaId: string) {
    return this.prisma.padronAcademico.findUnique({
      where: {
        dni_convocatoriaId: {
          dni: String(dni).replace(/\./g, ''),
          convocatoriaId,
        },
      },
    });
  }

  async findByLegajo(legajo: string, convocatoriaId: string) {
    return this.prisma.padronAcademico.findFirst({
      where: { legajo: String(legajo), convocatoriaId },
    });
  }

  async cargarMaestro(
    filePath: string,
    convocatoriaId: string,
  ): Promise<{ procesadas: number; errores: number }> {
    this.logger.log(`Procesando padrón: ${filePath}`);

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let rowIndex = 0;
    let headers: string[] = [];
    let procesadas = 0;
    let errores = 0;
    const batch: any[] = [];

    const flushBatch = async () => {
      if (batch.length === 0) return;
      const ops = batch.splice(0).map((row) =>
        this.prisma.padronAcademico
          .upsert({
            where: { dni_convocatoriaId: { dni: row.dni, convocatoriaId } },
            create: { ...row, convocatoriaId },
            update: { ...row },
          })
          .then(() => {
            procesadas++;
          })
          .catch((e) => {
            this.logger.warn(`Error upsert DNI=${row.dni}: ${e.message}`);
            errores++;
          }),
      );
      await Promise.all(ops);
    };

    for await (const line of rl) {
      rowIndex++;
      if (rowIndex < HEADER_ROW) continue;

      const values = parseCsvLine(line);

      if (rowIndex === HEADER_ROW) {
        headers = values.map((h) => h.trim());
        this.logger.log(
          `Headers encontrados: ${headers.slice(0, 6).join(', ')}...`,
        );
        continue;
      }

      const row = parseRow(headers, values);
      if (!row) continue;

      batch.push(row);

      if (batch.length >= BATCH_SIZE) {
        await flushBatch();
      }
    }

    // Flush del último lote
    await flushBatch();

    this.logger.log(
      `Padrón procesado: ${procesadas} filas OK, ${errores} errores`,
    );
    return { procesadas, errores };
  }
}
