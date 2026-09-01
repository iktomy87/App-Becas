import { PadronAcademico } from '@prisma/client';

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
  tipo: 'ERROR' | 'ADVERTENCIA' | 'CONFIRMACION_REQUERIDA';
  campo?: string;
  mensaje: string;
  valorPlanilla?: any;
  valorPadron?: any;
}

export interface ResultadoVerificacion {
  valida: boolean;
  requiereConfirmacion: boolean;
  errores: ErrorFila[];
  advertencias: ErrorFila[];
}

export function parsearPreferencias(row: any): { idPropuesta: string; orden: number }[] {
  const prefs: { idPropuesta: string; orden: number }[] = [];
  for (let i = 1; i <= 5; i++) {
    const cell = row[`Prioridad ${i}`] ?? row[`preferencia_${i}`] ?? row[`Postulación ${i}`];
    if (!cell) continue;
    const match = PREF_REGEX.exec(String(cell).trim());
    if (match) {
      prefs.push({ idPropuesta: match[1].trim(), orden: parseInt(match[2]) });
    }
  }
  return prefs;
}

export function verificarFila(
  rowIndex: number,
  fila: FilaInscripcion,
  padron: PadronAcademico | null,
): ResultadoVerificacion {
  const errores: ErrorFila[] = [];
  const advertencias: ErrorFila[] = [];
  let requiereConfirmacion = false;

  // --- DNI no existe ---
  if (!padron) {
    errores.push({ fila: rowIndex, tipo: 'ERROR', campo: 'dni', mensaje: `DNI ${fila.dni} no encontrado en el padrón académico` });
    return { valida: false, requiereConfirmacion: false, errores, advertencias };
  }

  // --- Estado no activo: requiere confirmación del operador ---
  if (padron.estado && padron.estado.toLowerCase() !== 'activo') {
    advertencias.push({
      fila: rowIndex,
      tipo: 'CONFIRMACION_REQUERIDA',
      campo: 'estado',
      mensaje: `El estudiante DNI ${fila.dni} tiene estado "${padron.estado}" en el padrón. ¿Descartar?`,
      valorPadron: padron.estado,
    });
    requiereConfirmacion = true;
  }

  // --- Verificaciones exactas ---
  if (fila.legajo && String(fila.legajo) !== String(padron.legajo)) {
    advertencias.push({
      fila: rowIndex, tipo: 'ADVERTENCIA', campo: 'legajo',
      mensaje: `Legajo difiere — planilla: ${fila.legajo}, padrón: ${padron.legajo}. Se usará el del padrón.`,
      valorPlanilla: fila.legajo, valorPadron: padron.legajo,
    });
  }

  if (fila.promedio !== undefined) {
    const promPadron = Number(padron.promedio);
    if (fila.promedio !== promPadron) {
      advertencias.push({
        fila: rowIndex, tipo: 'ADVERTENCIA', campo: 'promedio',
        mensaje: `Promedio difiere — planilla: ${fila.promedio}, padrón: ${promPadron}. Se usará el del padrón.`,
        valorPlanilla: fila.promedio, valorPadron: promPadron,
      });
    }
  }

  if (fila.aprobadas !== undefined && fila.aprobadas !== padron.aprobadas) {
    advertencias.push({
      fila: rowIndex, tipo: 'ADVERTENCIA', campo: 'aprobadas',
      mensaje: `Aprobadas difiere — planilla: ${fila.aprobadas}, padrón: ${padron.aprobadas}. Se usará el del padrón.`,
      valorPlanilla: fila.aprobadas, valorPadron: padron.aprobadas,
    });
  }

  if (fila.aplazos !== undefined && fila.aplazos !== padron.aplazos) {
    advertencias.push({
      fila: rowIndex, tipo: 'ADVERTENCIA', campo: 'aplazos',
      mensaje: `Aplazos difiere — planilla: ${fila.aplazos}, padrón: ${padron.aplazos}. Se usará el del padrón.`,
      valorPlanilla: fila.aplazos, valorPadron: padron.aplazos,
    });
  }

  // --- Preferencias ---
  if (fila.preferencias.length === 0) {
    errores.push({ fila: rowIndex, tipo: 'ERROR', campo: 'preferencias', mensaje: 'El estudiante no tiene preferencias declaradas' });
  }

  const ordenesVistos = new Set<number>();
  for (const pref of fila.preferencias) {
    if (ordenesVistos.has(pref.orden)) {
      errores.push({ fila: rowIndex, tipo: 'ERROR', campo: 'preferencias', mensaje: `Orden de preferencia duplicado: ${pref.orden}` });
    }
    ordenesVistos.add(pref.orden);
  }

  if (fila.preferencias.length > 5) {
    errores.push({ fila: rowIndex, tipo: 'ERROR', campo: 'preferencias', mensaje: `Máximo 5 preferencias permitidas (encontradas: ${fila.preferencias.length}) — se descartan las excedentes` });
  }

  const valida = errores.length === 0;
  return { valida, requiereConfirmacion, errores, advertencias };
}
