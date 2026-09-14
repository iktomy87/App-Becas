import { http } from './http';
import type { AsignacionPage, ResultadoAsignacion } from './types';
import { API_BASE_URL } from './config';

export const asignacionService = {
  /** POST /convocatorias/:convocatoriaId/asignacion/ejecutar */
  ejecutar: (convocatoriaId: string) =>
    http.post<{ mensaje: string }>(`/convocatorias/${convocatoriaId}/asignacion/ejecutar`),

  /** GET /convocatorias/:convocatoriaId/asignacion?page=&limit= */
  listar: (convocatoriaId: string, page = 1, limit = 50) =>
    http.get<AsignacionPage>(
      `/convocatorias/${convocatoriaId}/asignacion?page=${page}&limit=${limit}`,
    ),

  /** GET /convocatorias/:convocatoriaId/asignacion/estudiante/:dni */
  getPorDni: (convocatoriaId: string, dni: string) =>
    http.get<ResultadoAsignacion>(
      `/convocatorias/${convocatoriaId}/asignacion/estudiante/${dni}`,
    ),

  /** GET /convocatorias/:convocatoriaId/reportes/asignacion  → descarga Excel */
  descargarReporte: (convocatoriaId: string) => {
    window.open(
      `${API_BASE_URL}/convocatorias/${convocatoriaId}/reportes/asignacion`,
      '_blank',
    );
  },
};

