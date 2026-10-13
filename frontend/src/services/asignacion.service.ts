import { http } from './http';
import type {
  AsignacionPage,
  EstadoAsignacion,
  ResultadoAsignacion,
} from './types';
import { API_BASE_URL } from './config';

export const asignacionService = {
  /** POST /convocatorias/:convocatoriaId/asignacion/ejecutar */
  ejecutar: (convocatoriaId: string) =>
    http.post<{ corridaId: string; asignados: number; noAsignados: number }>(
      `/convocatorias/${convocatoriaId}/asignacion/ejecutar`,
    ),

  /**
   * GET /convocatorias/:convocatoriaId/asignacion?page=&limit=&estado=
   *
   * Devuelve `null` si la convocatoria todavía no tiene una corrida vigente
   * (la página lo usa para mostrar el estado "sin asignación").
   */
  listar: (
    convocatoriaId: string,
    page = 1,
    limit = 50,
    estado?: EstadoAsignacion,
  ) => {
    const filtro = estado ? `&estado=${estado}` : '';
    return http.get<AsignacionPage | null>(
      `/convocatorias/${convocatoriaId}/asignacion?page=${page}&limit=${limit}${filtro}`,
    );
  },

  /** GET /convocatorias/:convocatoriaId/asignacion/estudiante/:dni */
  getPorDni: (convocatoriaId: string, dni: string) =>
    http.get<ResultadoAsignacion>(
      `/convocatorias/${convocatoriaId}/asignacion/estudiante/${dni}`,
    ),

  /**
   * POST /convocatorias/:convocatoriaId/asignacion/:resultadoId/remover
   *
   * Retira al estudiante del área asignada y lo reubica en otra de sus
   * preferencias; si no hay cupo, queda como NO_ASIGNADO. Devuelve el resultado
   * actualizado.
   */
  remover: (convocatoriaId: string, resultadoId: string) =>
    http.post<ResultadoAsignacion>(
      `/convocatorias/${convocatoriaId}/asignacion/${resultadoId}/remover`,
    ),

  /** GET /convocatorias/:convocatoriaId/reportes/asignacion  → descarga Excel */
  descargarReporte: (convocatoriaId: string) => {
    window.open(
      `${API_BASE_URL}/convocatorias/${convocatoriaId}/reportes/asignacion`,
      '_blank',
    );
  },
};

