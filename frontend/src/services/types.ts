// ─── Tipos compartidos que espeja el schema Prisma del backend ────────────────

export type EstadoConvocatoria = 'ABIERTA' | 'CERRADA' | 'EN_RANKING' | 'ASIGNADA';
export type TipoPropuesta      = 'SERVICIO' | 'INVESTIGACION';
export type EstadoPropuesta    = 'BORRADOR' | 'PUBLICADA';
export type EstadoCarga        = 'PENDIENTE' | 'PROCESANDO' | 'COMPLETADA' | 'ERROR';
export type EstadoCorrida      = 'EN_CURSO' | 'COMPLETADA' | 'INVALIDADA';
export type EstadoAsignacion   = 'ASIGNADO' | 'NO_ASIGNADO';

// ─── Convocatoria ─────────────────────────────────────────────────────────────

export interface Convocatoria {
  id:            string;
  nombre:        string;
  fechaApertura: string;   // ISO 8601
  fechaCierre:   string;
  estado:        EstadoConvocatoria;
  createdAt:     string;
  updatedAt:     string;
}

export interface CreateConvocatoriaDto {
  nombre:        string;
  fechaApertura: string;
  fechaCierre:   string;
}

export interface UpdateConvocatoriaDto extends Partial<CreateConvocatoriaDto> {}

// ─── Propuesta ────────────────────────────────────────────────────────────────

export interface Propuesta {
  id:                  string;
  idExterno:           string;
  titulo:              string;
  tipo:                TipoPropuesta;
  responsableNombre:   string;
  responsableEmail:    string;
  vacantesTotal:       number;
  vacantesDisponibles: number;
  dependencia?:        string;
  especialidades?:     string;
  periodo?:            string;
  horario?:            string;
  estado:              EstadoPropuesta;
  convocatoriaId:      string;
}

// ─── Ranking ──────────────────────────────────────────────────────────────────

export interface ResultadoRanking {
  id:                   string;
  padronId:             string;
  convocatoriaId:       string;
  posicion?:            number | null;
  // Prisma Decimal se serializa a JSON como string: usar Number() al comparar
  // o formatear.
  puntajeTotal:         string;
  terminoPromedio:      string;
  terminoAprobadas:     string;
  terminoAvance:        string;
  terminoAplazos:       string;
  bonusAntecedentes?:   string;
  criterioDesempateVal?: string;
  habilitado:           boolean;
  motivoInhabilitacion?: string;
  padron: {
    nombreCompleto: string;
    dni:            string;
    legajo:         string;
    especialidadCodigo?: number | null;
    /** Nombre de la carrera ya resuelto por el backend. `null` si no se conoce. */
    especialidad?:  string | null;
    // Prisma Decimal se serializa a JSON como string, no como number.
    promedio:       string;
    cursando?:      number;
    regularizadas:  number;
    aprobadas:      number;
    aplazos:        number;
  };
  /** Siempre presente: el backend lo devuelve siempre, aunque sea vacío. */
  postulaciones: Array<{
    ordenPreferencia: number;
    propuestaId:      string;
  }>;
}

export interface RankingPage {
  data:  ResultadoRanking[];
  total: number;
  page:  number;
  limit: number;
}

export interface InscripcionesPage {
  data:  Inscripcion[];
  total: number;
  page:  number;
  limit: number;
}

// ─── Carga de planilla ────────────────────────────────────────────────────────

/**
 * Una entrada del reporte de errores o advertencias de una carga (RF-07).
 * Espeja el `ErrorFila` del backend (`importacion/planilla-verifier.ts`).
 */
export interface ReporteFila {
  /** Número de fila tal como viene en el archivo. */
  fila: number;
  /**
   * `CONFIRMACION_REQUERIDA` ya no lo produce el backend: las filas con estado
   * de padrón distinto de "Activo" se importan y se reportan como
   * `ADVERTENCIA`. El valor sigue en la unión porque las cargas anteriores a
   * ese cambio lo tienen persistido en `reporte_advertencias`.
   */
  tipo: 'ERROR' | 'ADVERTENCIA' | 'CONFIRMACION_REQUERIDA';
  campo?: string;
  mensaje: string;
  /** Valor que traía la planilla, cuando el error es una discrepancia. */
  valorPlanilla?: unknown;
  /** Valor del padrón, cuando el error es una discrepancia. */
  valorPadron?: unknown;
}

/**
 * Resultado del job de importación de planillas — es lo que devuelve
 * `GET /convocatorias/:id/planilla/status/:jobId` en `resultado`.
 */
export interface ResultadoImportacionPlanilla {
  cargaId: string;
  filasTotal: number;
  filasValidas: number;
  filasError: number;
  filasConAdvertencias: number;
  /**
   * Cuántas filas del padrón quedaron con el `aplazos` que trajo la planilla.
   *
   * El maestro no tiene columna de aplazos, así que el valor sale de la planilla
   * y antes no quedaba persistido en ningún lado: la pantalla de inscripciones
   * mostraba el `Cant.` de una importación vieja. Es 0 cuando el archivo no
   * trae la columna, así que sirve para distinguir "no había dato" de "no se
   * guardó".
   */
  aplazosPersistidos: number;
  errores: ReporteFila[];
  advertencias: ReporteFila[];
}

/** Resultado del job de carga del padrón. */
export interface ResultadoImportacionPadron {
  procesadas: number;
  errores: number;
}

/** Progreso que reporta el worker mientras procesa. */
export interface ProgresoImportacion {
  rowsProcessed: number;
}

/**
 * Estado de un job de BullMQ, según lo devuelven los endpoints de estado
 * (`planilla/status/:jobId` y `padron/status/:jobId`).
 *
 * `progress` es `ProgresoImportacion` en los jobs que llaman a
 * `updateProgress`, y el `0` por defecto de BullMQ en los que no.
 */
export interface EstadoJob<T> {
  state: string;
  progress: ProgresoImportacion | number | null;
  resultado?: T;
  error?: string;
}

export interface CargaPlanilla {
  id:               string;
  convocatoriaId:   string;
  filename:         string;
  /** Ruta del archivo subido en el servidor. */
  storagePath:      string;
  estado:           EstadoCarga;
  filasTotal:       number;
  filasValidas:     number;
  filasError:       number;
  filasAdvertencia: number;
  /**
   * Reporte fila por fila (RF-07). Venía en la respuesta del backend pero el
   * tipo lo omitía, así que era inalcanzable desde código tipado.
   */
  reporteErrores:      ReporteFila[] | null;
  reporteAdvertencias: ReporteFila[] | null;
  vigente:          boolean;
  createdAt:        string;
}

// ─── Inscripciones ────────────────────────────────────────────────────────────

/**
 * Fila de GET /convocatorias/:id/planillas/inscripciones.
 *
 * Antes esta forma no estaba tipada y la página la consumía como `any[]`, así
 * que ningún campo —incluido el nombre de la carrera— lo chequeaba el
 * compilador.
 */
export interface Inscripcion {
  id:                  string;
  dni:                 string;
  legajo:              string;
  nombreCompleto:      string;
  especialidadCodigo?: number | null;
  /** Nombre de la carrera, resuelto por el backend desde el catálogo. */
  especialidad?:       string | null;
  /** Prisma Decimal serializado como string. */
  promedio:            string;
  cursando:            number;
  regularizadas:       number;
  aprobadas:           number;
  aplazos:             number;
  estado:              string;
  postulaciones:       Array<{
    id:               string;
    ordenPreferencia: number;
    propuestaId:      string;
    propuesta: {
      idExterno: string;
      titulo:     string;
      tipo:       TipoPropuesta;
    };
  }>;
}

// ─── Asignación ───────────────────────────────────────────────────────────────

export interface ResultadoAsignacion {
  id:                   string;
  padronId:             string;
  propuestaId?:         string;
  preferenciaSatisfecha?: number;
  estado:               EstadoAsignacion;
  padron?: {
    nombreCompleto: string;
    dni:            string;
    legajo:         string;
  };
  propuesta?: {
    titulo: string;
    tipo:   TipoPropuesta;
  };
}

export interface AsignacionPage {
  data:  ResultadoAsignacion[];
  total: number;
  page:  number;
  limit: number;
}

