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
  posicion?:            number;
  puntajeTotal:         number;
  terminoPromedio:      number;
  terminoAprobadas:     number;
  terminoAvance:        number;
  terminoAplazos:       number;
  habilitado:           boolean;
  motivoInhabilitacion?: string;
  padron: {
    nombreCompleto: string;
    dni:            string;
    legajo:         string;
    especialidadCodigo?: number;
    promedio:       number;
  };
  postulaciones?: Array<{
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

// ─── Carga de planilla ────────────────────────────────────────────────────────

export interface CargaPlanilla {
  id:               string;
  convocatoriaId:   string;
  filename:         string;
  estado:           EstadoCarga;
  filasTotal:       number;
  filasValidas:     number;
  filasError:       number;
  filasAdvertencia: number;
  vigente:          boolean;
  createdAt:        string;
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

