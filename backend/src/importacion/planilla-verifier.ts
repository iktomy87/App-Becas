import { PadronAcademico } from '@prisma/client';
import {
  resolverDatosPlanillaVsPadron,
  describirCambio,
  ResolucionPlanilla,
} from '../padron/resolver-datos';

// Regex para parsear "1128111635975267 - prio: 3"
const PREF_REGEX = /^(.+?)\s*-\s*prio:\s*(\d)$/i;

export interface FilaInscripcion {
  dni: string;
  legajo?: string;
  nombre?: string;
  apellido?: string;
  email?: string;
  carrera?: string;
  promedio?: number;
  aprobadas?: number;
  cursadas?: number;
  aplazos?: number;
  preferencias: { idPropuesta: string; orden: number }[];
}

export interface ErrorFila {
  fila: number;
  tipo: 'ERROR' | 'ADVERTENCIA';
  campo?: string;
  mensaje: string;
  valorPlanilla?: any;
  valorPadron?: any;
}

export interface ResultadoVerificacion {
  valida: boolean;
  errores: ErrorFila[];
  advertencias: ErrorFila[];
  /**
   * Valores efectivos tras aplicar la prioridad del padrón. Se incluye para que
   * quien puntúe use los mismos valores que quedaron anotados en el reporte;
   * antes no existía, y por eso el puntaje salía siempre con los de la planilla
   * mientras el reporte anunciaba lo contrario.
   */
  datos: ResolucionPlanilla;
}

/** Una celda de preferencia que existe pero no se pudo interpretar. */
export interface PreferenciaInvalida {
  /** Columna del archivo de la que salió, p.ej. "Prioridad 3". */
  columna: string;
  /** Valor crudo tal como venía en el archivo. */
  valor: string;
  motivo: string;
}

export interface ResultadoPreferencias {
  preferencias: { idPropuesta: string; orden: number }[];
  invalidas: PreferenciaInvalida[];
}

/** Nombres de columna aceptados para la preferencia N, en orden de prioridad. */
const COLUMNAS_PREFERENCIA = [
  (i: number) => `Prioridad ${i}`,
  (i: number) => `preferencia_${i}`,
  (i: number) => `Postulación ${i}`,
];

const MOTIVO_FORMATO_PREF =
  'Se esperaba el formato "<idPropuesta> - prio: <1-5>"';

/**
 * Lee las preferencias de una fila.
 *
 * Una celda que no existe no es un error. Una celda que existe pero no se puede
 * interpretar sí: se devuelve en `invalidas` para que el llamador la reporte
 * fila por fila (RF-07). Antes esas celdas se ignoraban en silencio, y si todas
 *las de la fila fallaban el único síntoma era "no tiene preferencias
 * declaradas", que señalaba el efecto y no la causa.
 */
export function parsearPreferencias(row: any): ResultadoPreferencias {
  const preferencias: { idPropuesta: string; orden: number }[] = [];
  const invalidas: PreferenciaInvalida[] = [];

  for (let i = 1; i <= 5; i++) {
    let columna = '';
    let valor = '';
    for (const nombre of COLUMNAS_PREFERENCIA) {
      const celda = nombre(i);
      if (row[celda] == null) continue;
      const texto = String(row[celda]).trim();
      if (texto === '') continue; // celda presente pero vacía: no es preferencia
      columna = celda;
      valor = texto;
      break;
    }
    if (columna === '') continue;

    const match = PREF_REGEX.exec(valor);
    if (match) {
      preferencias.push({
        idPropuesta: match[1].trim(),
        orden: parseInt(match[2], 10),
      });
    } else {
      invalidas.push({ columna, valor, motivo: MOTIVO_FORMATO_PREF });
    }
  }

  return { preferencias, invalidas };
}

export function verificarFila(
  rowIndex: number,
  fila: FilaInscripcion,
  padron: PadronAcademico | null,
): ResultadoVerificacion {
  const errores: ErrorFila[] = [];
  const advertencias: ErrorFila[] = [];

  // --- DNI no existe ---
  if (!padron) {
    errores.push({
      fila: rowIndex,
      tipo: 'ERROR',
      campo: 'dni',
      mensaje: `DNI ${fila.dni} no encontrado en el padrón académico`,
    });
    // Sin padrón no hay resolución posible: se devuelven los valores de la
    // planilla sin tocar, para que el llamador pueda reportar algo concreto.
    return {
      valida: false,
      errores,
      advertencias,
      datos: {
        legajo: String(fila.legajo ?? ''),
        promedio: fila.promedio ?? 0,
        aprobadas: fila.aprobadas ?? 0,
        cursadas: fila.cursadas ?? 0,
        aplazos: fila.aplazos ?? 0,
        reemplazados: [],
        conservados: [],
      },
    };
  }

  // --- Estado no activo ---
  // No bloquea la importación. RN-11 sólo excluye las filas que NO superan las
  // validaciones de RF-07, y el estado del padrón no figura entre ellas; por lo
  // tanto la fila es válida y se importa. La discrepancia se reporta como
  // advertencia y queda persistida en `reporte_advertencias`, de modo que el
  // operador la ve aunque recargue la página.
  if (padron.estado && padron.estado.toLowerCase() !== 'activo') {
    advertencias.push({
      fila: rowIndex,
      tipo: 'ADVERTENCIA',
      campo: 'estado',
      mensaje: `Estado "${padron.estado}" en el padrón (distinto de "Activo") — la postulación se importa igual.`,
      valorPadron: padron.estado,
    });
  }

  // --- Datos: el padrón es la fuente autorizada ---
  // Antes estos cuatro avisos decían "Se usará el del padrón" y no cambiaban
  // nada: el puntaje salía siempre con los valores de la planilla. Ahora la
  // resolución se calcula una vez y el reporte declara el valor que queda.
  //
  // `aplazos` no se contrasta porque el maestro no tiene esa columna (ver
  // `resolver-datos.ts`): el aviso anterior comparaba contra un `padron.aplazos`
  // que venía del campo de domicilio `Cant.` y prometía usar un 0 como si fuera
  // un conteo real.
  const datos = resolverDatosPlanillaVsPadron(padron, fila);

  for (const cambio of datos.reemplazados) {
    advertencias.push({
      fila: rowIndex,
      tipo: 'ADVERTENCIA',
      campo: cambio.campo,
      mensaje: `${describirCambio(cambio)} — se usa el del padrón.`,
      valorPlanilla: cambio.valorPlanilla,
      valorPadron: cambio.valorPadron,
    });
  }

  for (const cambio of datos.conservados) {
    advertencias.push({
      fila: rowIndex,
      tipo: 'ADVERTENCIA',
      campo: cambio.campo,
      mensaje:
        `El padrón no trae "${cambio.campo}" para el DNI ${fila.dni} — ` +
        `se conserva el de la planilla: "${cambio.valorPlanilla}".`,
      valorPlanilla: cambio.valorPlanilla,
      valorPadron: cambio.valorPadron,
    });
  }

  // --- Preferencias ---
  if (fila.preferencias.length === 0) {
    errores.push({
      fila: rowIndex,
      tipo: 'ERROR',
      campo: 'preferencias',
      mensaje: 'El estudiante no tiene preferencias declaradas',
    });
  }

  const ordenesVistos = new Set<number>();
  for (const pref of fila.preferencias) {
    if (ordenesVistos.has(pref.orden)) {
      errores.push({
        fila: rowIndex,
        tipo: 'ERROR',
        campo: 'preferencias',
        mensaje: `Orden de preferencia duplicado: ${pref.orden}`,
      });
    }
    ordenesVistos.add(pref.orden);
  }

  if (fila.preferencias.length > 5) {
    errores.push({
      fila: rowIndex,
      tipo: 'ERROR',
      campo: 'preferencias',
      mensaje: `Máximo 5 preferencias permitidas (encontradas: ${fila.preferencias.length}) — se descartan las excedentes`,
    });
  }

  const valida = errores.length === 0;
  return { valida, errores, advertencias, datos };
}
