import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RankingV1Strategy } from './strategies/ranking-v1.strategy';
import { EstadoConvocatoria } from '@prisma/client';
import {
  nombreEspecialidad,
  materiasDelPlanPorCodigo,
  MATERIAS_PLAN_POR_DEFECTO,
} from '../especialidades/especialidades';
import {
  resolverDatosPlanillaVsPadron,
  describirCambio,
} from '../padron/resolver-datos';
import { persistirAplazosDePlanilla } from '../padron/persistir-aplazos';
import { leerNumero, leerEntero, leerDni } from '../common/numero';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';

@Injectable()
export class RankingService {
  private readonly logger = new Logger(RankingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly strategy: RankingV1Strategy,
  ) {}

  async calcularRanking(
    convocatoriaId: string,
  ): Promise<{ calculados: number; inhabilitados: number }> {
    const conv = await this.prisma.convocatoria.findUnique({
      where: { id: convocatoriaId },
      include: { rankingConfig: true },
    });
    if (!conv) throw new Error('Convocatoria no encontrada');
    if (
      conv.estado !== EstadoConvocatoria.CERRADA &&
      conv.estado !== EstadoConvocatoria.EN_RANKING
    ) {
      throw new Error(
        'La convocatoria debe estar CERRADA para calcular el ranking',
      );
    }

    // `resultados_ranking.ranking_config_id` es una FK obligatoria, así que sin
    // fila en `ranking_config` no existe un config "virtual": el objeto en
    // memoria con `id: ''` que se usaba antes moría con violación de FK en la
    // primera fila. Peor aún: el worker envuelve el recálculo en un try/catch
    // que lo marca "no crítico", así que la carga quedaba COMPLETADA y el
    // ranking vacío en toda convocatoria que no tuviera config previo.
    //
    // Se persiste con los mismos valores que declaraba el fallback anterior,
    // que coinciden con los defaults del modelo, y con `tipo: 'SERVICIO'`
    // porque acá el puntaje se calcula internamente (no viene importado, como
    // en `importarRanking`, que usa 'EXTERNO').
    const config =
      conv.rankingConfig ??
      (await this.prisma.rankingConfig.create({
        data: {
          convocatoriaId,
          nombre: 'RankingV1',
          tipo: 'SERVICIO',
          minMateriasCursando: 3,
          minRegularizadas: 1,
          criterioDesempate: 'PROMEDIO',
        },
      }));

    // Cambiar estado a EN_RANKING
    await this.prisma.convocatoria.update({
      where: { id: convocatoriaId },
      data: { estado: EstadoConvocatoria.EN_RANKING },
    });

    // Obtener postulantes únicos por cursor (streaming — RNF-02)
    const postulantesUnicos = await this.prisma.postulacion.findMany({
      where: { convocatoriaId },
      select: { padronId: true },
      distinct: ['padronId'],
    });

    let calculados = 0;
    let inhabilitados = 0;

    for (const { padronId } of postulantesUnicos) {
      const padron = await this.prisma.padronAcademico.findUnique({
        where: { id: padronId },
      });
      if (!padron) continue;

      const habilitacion = this.strategy.verificarHabilitacion(padron, {
        minMateriasCursando: config.minMateriasCursando,
        minRegularizadas: config.minRegularizadas,
      });

      // Fallback: sin archivo de orden de mérito no hay `Mat. de la carrera`,
      // así que el total del plan sale del catálogo de especialidades. Se avisa
      // una sola vez si algún código no está, porque el resultado depende de
      // un valor asumido.
      const totalMateriasPlan = materiasDelPlanPorCodigo(
        padron.especialidadCodigo,
      );
      if (totalMateriasPlan === null && padron.especialidadCodigo != null) {
        this.logger.warn(
          `Especialidad ${padron.especialidadCodigo} fuera del catálogo: se asume un plan de ${MATERIAS_PLAN_POR_DEFECTO} materias. Conviene cargar el orden de mérito, que trae "Mat. de la carrera".`,
        );
      }

      const desglose = habilitacion.habilitado
        ? this.strategy.calcularPuntaje({
            promedio: Number(padron.promedio),
            aprobadas: padron.aprobadas,
            // Sin archivo de orden de mérito no hay columna `Cursadas`:
            // se usa `Cursando año actual` del padrón como equivalente más cercano.
            cursadas: padron.cursando,
            aplazos: padron.aplazos,
            totalMateriasPlan: totalMateriasPlan ?? MATERIAS_PLAN_POR_DEFECTO,
            // El padrón no trae antecedentes; el bonus sólo aplica si se
            // importó el archivo de orden de mérito.
            bonusAntecedentes: 0,
          })
        : {
            terminoPromedio: 0,
            terminoAprobadas: 0,
            terminoAvance: 0,
            terminoAplazos: 0,
            bonusAntecedentes: 0,
            puntajeTotal: 0,
          };

      await this.prisma.resultadoRanking.upsert({
        where: { padronId_convocatoriaId: { padronId, convocatoriaId } },
        create: {
          padronId,
          convocatoriaId,
          rankingConfigId: config.id,
          puntajeTotal: desglose.puntajeTotal,
          terminoPromedio: desglose.terminoPromedio,
          terminoAprobadas: desglose.terminoAprobadas,
          terminoAvance: desglose.terminoAvance,
          terminoAplazos: desglose.terminoAplazos,
          bonusAntecedentes: desglose.bonusAntecedentes,
          habilitado: habilitacion.habilitado,
          motivoInhabilitacion: habilitacion.motivo ?? null,
          criterioDesempateVal: Number(padron.promedio),
        },
        update: {
          puntajeTotal: desglose.puntajeTotal,
          terminoPromedio: desglose.terminoPromedio,
          terminoAprobadas: desglose.terminoAprobadas,
          terminoAvance: desglose.terminoAvance,
          terminoAplazos: desglose.terminoAplazos,
          habilitado: habilitacion.habilitado,
          motivoInhabilitacion: habilitacion.motivo ?? null,
        },
      });

      habilitacion.habilitado ? calculados++ : inhabilitados++;
    }

    // Asignar posiciones ordenadas descendentemente
    const rankingOrdenado = await this.prisma.resultadoRanking.findMany({
      where: { convocatoriaId, habilitado: true },
      orderBy: [{ puntajeTotal: 'desc' }, { criterioDesempateVal: 'desc' }],
    });

    for (let i = 0; i < rankingOrdenado.length; i++) {
      await this.prisma.resultadoRanking.update({
        where: { id: rankingOrdenado[i].id },
        data: { posicion: i + 1 },
      });
    }

    return { calculados, inhabilitados };
  }

  async getRanking(convocatoriaId: string, page = 1, limit = 50) {
    const [data, total] = await Promise.all([
      this.prisma.resultadoRanking.findMany({
        where: { convocatoriaId },
        orderBy: [{ posicion: 'asc' }, { puntajeTotal: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          padron: {
            select: {
              dni: true,
              legajo: true,
              nombreCompleto: true,
              // Sin esto el frontend no puede mostrar la carrera: sólo
              // recibía el código y su propio CARRERA_MAP hardcodeado.
              especialidadCodigo: true,
              promedio: true,
              regularizadas: true,
              aprobadas: true,
              aplazos: true,
            },
          },
        },
      }),
      this.prisma.resultadoRanking.count({ where: { convocatoriaId } }),
    ]);

    // La columna "Prioridades" del panel principal se armaba con `postulaciones`
    // pero el backend nunca lo devolvía, así que salía siempre vacía.
    // `ResultadoRanking` no tiene relación con `Postulacion` en Prisma, así que
    // se resuelve con un segundo query sobre los padrones de esta página.
    const padronIds = data.map((r) => r.padronId);
    const postulaciones =
      padronIds.length === 0
        ? []
        : await this.prisma.postulacion.findMany({
            where: { convocatoriaId, padronId: { in: padronIds } },
            orderBy: [{ padronId: 'asc' }, { ordenPreferencia: 'asc' }],
            select: {
              padronId: true,
              ordenPreferencia: true,
              propuestaId: true,
            },
          });

    const prefsPorPadron = new Map<
      string,
      { ordenPreferencia: number; propuestaId: string }[]
    >();
    for (const p of postulaciones) {
      const list = prefsPorPadron.get(p.padronId) ?? [];
      list.push({
        ordenPreferencia: p.ordenPreferencia,
        propuestaId: p.propuestaId,
      });
      prefsPorPadron.set(p.padronId, list);
    }

    // Se resuelve el nombre de la carrera acá para que el frontend no tenga
    // que duplicar el diccionario de especialidades.
    return {
      data: data.map((r) => ({
        ...r,
        postulaciones: prefsPorPadron.get(r.padronId) ?? [],
        padron: {
          ...r.padron,
          especialidad: nombreEspecialidad(r.padron.especialidadCodigo),
        },
      })),
      total,
      page,
      limit,
    };
  }

  getDesglose(convocatoriaId: string, dni: string) {
    return this.prisma.resultadoRanking.findFirst({
      where: { convocatoriaId, padron: { dni } },
      include: { padron: true, rankingConfig: true },
    });
  }
  /** Fila cruda leída del archivo de orden de mérito (CSV o Excel). */
  private interpretarFilaRanking(getCampo: (...claves: string[]) => any) {
    // Antes: `Number(String(v ?? '').replace(',', '.').trim())`, que devolvía
    // `NaN` ante texto no numérico y truncaba en `"1.234,56"` → 1. Ahora el
    // parser decide el separador por estructura y devuelve 0 en vez de NaN.
    const numero = (v: any) => leerNumero(v);
    const entero = (v: any) => leerEntero(v);
    const rawDni = getCampo('DNI', 'DOCUMENTO') ?? '';
    const dni = leerDni(rawDni);
    return {
      dni,
      promedio: numero(getCampo('PROMEDIO')),
      // Conteos de materias: enteros por naturaleza, así que un "17,7" se
      // trunca a 17 en vez de propagar un decimal imposible.
      aprobadas: entero(getCampo('APROBADAS')),
      cursadas: entero(getCampo('CURSADAS')),
      // Este dato viene siempre del archivo — cada carrera tiene un plan distinto
      // (ISI=42, IEM/IQ=45, LAR=36, TUP/TUM=18, etc.) y no hay que adivinarlo.
      materiasPlan: entero(
        getCampo(
          'MAT DE LA CARRERA',
          'MATERIAS DE LA CARRERA',
          'MATERIAS DEL PLAN',
          'MATERIAS PLAN',
        ),
      ),
      aplazos: entero(getCampo('APLAZOS')),
      bonusAntecedentes: numero(getCampo('ANTECEDENTES')),
    };
  }

  private normalizarHeader(s: string): string {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, ' ')
      .trim();
  }

  async importarRanking(convocatoriaId: string, file: Express.Multer.File) {
    const conv = await this.prisma.convocatoria.findUnique({
      where: { id: convocatoriaId },
      include: { rankingConfig: true },
    });
    if (!conv) throw new Error('Convocatoria no encontrada');

    const config =
      conv.rankingConfig ??
      (await this.prisma.rankingConfig.create({
        data: {
          convocatoriaId,
          nombre: 'Importado',
          tipo: 'EXTERNO',
          minMateriasCursando: 0,
          minRegularizadas: 0,
          criterioDesempate: 'PROMEDIO',
        },
      }));

    // 1. Parsear el archivo de orden de mérito completo: trae, por alumno,
    //    Promedio, Aprobadas, Cursadas, Mat. de la carrera, Aplazos y Antecedentes.
    //    Todo sale del archivo — no se infiere ni se hardcodea nada acá.
    type FilaRanking = ReturnType<RankingService['interpretarFilaRanking']>;
    const filas: FilaRanking[] = [];
    const esCsv = file.originalname.toLowerCase().endsWith('.csv');

    if (esCsv) {
      const csv = require('csv-parser');
      await new Promise<void>((resolve, reject) => {
        fs.createReadStream(file.path)
          .pipe(csv())
          .on('data', (data: any) => {
            const claveOriginal = new Map(
              Object.keys(data).map((k) => [this.normalizarHeader(k), k]),
            );
            const getCampo = (...claves: string[]) => {
              for (const clave of claves) {
                const original = claveOriginal.get(clave);
                if (original !== undefined) return data[original];
              }
              return undefined;
            };
            const fila = this.interpretarFilaRanking(getCampo);
            if (fila.dni) filas.push(fila);
          })
          .on('end', () => resolve())
          .on('error', (err: any) => reject(err));
      });
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(file.path);
      const sheet = workbook.worksheets[0];
      const headers: string[] = [];
      sheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber] = this.normalizarHeader(String(cell.value ?? ''));
      });
      const colIndex = (...claves: string[]) =>
        headers.findIndex((h) => claves.includes(h));

      for (let i = 2; i <= sheet.rowCount; i++) {
        const row = sheet.getRow(i);
        const getCampo = (...claves: string[]) => {
          const idx = colIndex(...claves);
          return idx > 0 ? row.getCell(idx).value : undefined;
        };
        const fila = this.interpretarFilaRanking(getCampo);
        if (fila.dni) filas.push(fila);
      }
    }
    // Solo borrar si es copia temporal del auto-recalculo; el original se conserva para re-usos futuros
    if (file.path.endsWith('.tmp_recalc')) {
      try {
        fs.unlinkSync(file.path);
      } catch {
        /* ignorar */
      }
    }

    // 2. Traer los padrones correspondientes, solo para poder linkear el padronId
    const padrones = await this.prisma.padronAcademico.findMany({
      where: { convocatoriaId, dni: { in: filas.map((f) => f.dni) } },
    });
    const padronPorDni = new Map(padrones.map((p) => [p.dni, p]));

    let filasTotal = 0;
    let filasValidas = 0;
    let filasError = 0;
    const errores: string[] = [];
    const advertencias: string[] = [];
    /**
     * `aplazos` resueltos que hay que dejar en la fila del padrón. El maestro
     * no trae la columna (ver `COL_MAP` en `padron.service.ts`), así que antes
     * de este bloque la fila quedaba con el `Cant.` de una importación vieja —43
     * para el DNI 42732664, cuando el valor real es 1— o en 0, y las pantallas
     * de inscripciones y de ranking muestran justamente ese campo.
     *
     * Sólo se anota lo que difiere de lo ya guardado, para no escribir las 176
     * filas en cada importación.
     */
    const aplazosResueltos: { padronId: string; aplazos: number }[] = [];

    // 3. Calcular el puntaje reutilizando la misma fórmula que usa calcularRanking,
    //    pero con los valores tal como vienen en el archivo (fuente de verdad).
    for (const fila of filas) {
      filasTotal++;
      const padron = padronPorDni.get(fila.dni);

      if (!padron) {
        filasError++;
        errores.push(
          `DNI ${fila.dni}: no se encontró en el padrón de esta convocatoria`,
        );
        continue;
      }
      // `Mat. de la carrera` del archivo manda siempre. Sólo si falta, se cae
      // al catálogo de especialidades; y si tampoco está, se descarta la fila
      // en vez de calcular un factor con un denominador inventado.
      const totalMateriasPlan =
        fila.materiasPlan ||
        materiasDelPlanPorCodigo(padron.especialidadCodigo);

      if (!totalMateriasPlan) {
        filasError++;
        errores.push(
          `DNI ${fila.dni}: falta "Mat. de la carrera" en el archivo y la especialidad ${padron.especialidadCodigo ?? '(sin código)'} no está en el catálogo; no se puede calcular el factor`,
        );
        continue;
      }

      // El padrón es la fuente autorizada: si el maestro trae `promedio` o
      // `aprobadas`, su valor gana sobre el de la planilla. `cursadas` y
      // `aplazos` salen siempre del archivo porque el maestro no tiene columna
      // equivalente (ver `resolver-datos.ts`). Antes acá se usaba `fila.*` sin
      // más, así que el orden de mérito del archivo pisaba al padrón.
      const datos = resolverDatosPlanillaVsPadron(padron, fila);

      for (const cambio of datos.reemplazados) {
        advertencias.push(
          `DNI ${fila.dni}: ${describirCambio(cambio)} — se usa el del padrón.`,
        );
      }
      for (const cambio of datos.conservados) {
        advertencias.push(
          `DNI ${fila.dni}: el padrón no trae "${cambio.campo}" ` +
            `— se conserva el de la planilla: "${cambio.valorPlanilla}".`,
        );
      }

      // `Cursadas` es el numerador del término de avance y `Mat. de la carrera`
      // el denominador. El bonus de antecedentes lo suma el strategy una sola
      // vez dentro de `puntajeTotal`.
      const desglose = this.strategy.calcularPuntaje({
        promedio: datos.promedio,
        aprobadas: datos.aprobadas,
        cursadas: datos.cursadas,
        aplazos: datos.aplazos,
        totalMateriasPlan,
        bonusAntecedentes: fila.bonusAntecedentes,
      });

      await this.prisma.resultadoRanking.upsert({
        where: {
          padronId_convocatoriaId: { padronId: padron.id, convocatoriaId },
        },
        create: {
          padronId: padron.id,
          convocatoriaId,
          rankingConfigId: config.id,
          puntajeTotal: desglose.puntajeTotal,
          terminoPromedio: desglose.terminoPromedio,
          terminoAprobadas: desglose.terminoAprobadas,
          terminoAvance: desglose.terminoAvance,
          terminoAplazos: desglose.terminoAplazos,
          bonusAntecedentes: desglose.bonusAntecedentes,
          criterioDesempateVal: datos.promedio,
        },
        update: {
          puntajeTotal: desglose.puntajeTotal,
          terminoPromedio: desglose.terminoPromedio,
          terminoAprobadas: desglose.terminoAprobadas,
          terminoAvance: desglose.terminoAvance,
          terminoAplazos: desglose.terminoAplazos,
          bonusAntecedentes: desglose.bonusAntecedentes,
          criterioDesempateVal: datos.promedio,
        },
      });
      filasValidas++;
      if (padron.aplazos !== datos.aplazos) {
        aplazosResueltos.push({
          padronId: padron.id,
          aplazos: datos.aplazos,
        });
      }
    }

    // El puntaje ya quedó guardado con los valores con prioridad de padrón; ahora
    // se deja el `aplazos` en la fila del padrón para que las listas lo muestren
    // sin tener que recomponer la resolución.
    if (aplazosResueltos.length > 0) {
      await persistirAplazosDePlanilla(this.prisma, aplazosResueltos);
    }

    // 4. Asignar posiciones ordenadas — igual que hace calcularRanking, pero
    //    acá antes faltaba este paso por completo.
    const rankingOrdenado = await this.prisma.resultadoRanking.findMany({
      where: { convocatoriaId },
      orderBy: [{ puntajeTotal: 'desc' }, { criterioDesempateVal: 'desc' }],
    });
    for (let i = 0; i < rankingOrdenado.length; i++) {
      await this.prisma.resultadoRanking.update({
        where: { id: rankingOrdenado[i].id },
        data: { posicion: i + 1 },
      });
    }

    // Cambiar estado a EN_RANKING
    await this.prisma.convocatoria.update({
      where: { id: convocatoriaId },
      data: { estado: EstadoConvocatoria.EN_RANKING },
    });

    // Guardar el path del archivo de antecedentes para re-usar al recalcular
    // No borramos el archivo — lo necesitamos si llega una nueva planilla
    await this.prisma.convocatoria.update({
      where: { id: convocatoriaId },
      data: { antecedentesPath: file.path } as any,
    });

    return {
      filasTotal,
      filasValidas,
      filasError,
      errores,
      advertencias,
      aplazosPersistidos: aplazosResueltos.length,
    };
  }

  /**
   * Recalcula el ranking automáticamente tras cargar una nueva planilla.
   * - Si existe un archivo de antecedentes previo → usa importarRanking con ese archivo
   * - Si no → usa calcularRanking (fórmula interna del padrón)
   */
  async recalcularAutoRanking(convocatoriaId: string): Promise<void> {
    const conv = await this.prisma.convocatoria.findUnique({
      where: { id: convocatoriaId },
    });
    if (!conv) return;

    const antecedentesPath = (conv as any).antecedentesPath as string | null;

    if (antecedentesPath && fs.existsSync(antecedentesPath)) {
      this.logger.log(`Auto-ranking con antecedentes: ${antecedentesPath}`);
      // Simular el objeto file que espera importarRanking
      const fileName = antecedentesPath.split('/').pop() ?? 'antecedentes.csv';
      const fakeFile = {
        path: antecedentesPath,
        originalname: fileName,
      } as Express.Multer.File;
      // Temporalmente no borramos el archivo (importarRanking llama unlinkSync — hacemos una copia)
      const tempPath = antecedentesPath + '.tmp_recalc';
      fs.copyFileSync(antecedentesPath, tempPath);
      fakeFile.path = tempPath;
      await this.importarRanking(convocatoriaId, fakeFile);
      // Restaurar el path original (importarRanking borró la copia)
      // El original sigue intacto
    } else {
      this.logger.log(
        `Auto-ranking sin antecedentes para convocatoria ${convocatoriaId}`,
      );
      // calcularRanking requiere estado CERRADA/EN_RANKING — cambiamos temporalmente
      const estadoOriginal = conv.estado;
      if (estadoOriginal === 'ABIERTA') {
        await this.prisma.convocatoria.update({
          where: { id: convocatoriaId },
          data: { estado: 'CERRADA' as any },
        });
      }
      try {
        await this.calcularRanking(convocatoriaId);
      } finally {
        // Si estaba ABIERTA, la devolvemos a ABIERTA (calcularRanking la pasa a EN_RANKING)
        if (estadoOriginal === 'ABIERTA') {
          await this.prisma.convocatoria.update({
            where: { id: convocatoriaId },
            data: { estado: estadoOriginal },
          });
        }
      }
    }
  }
}
