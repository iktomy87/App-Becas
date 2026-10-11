import { http } from './http';
import type { Propuesta, PropuestasPage } from './types';

export interface CreatePropuestaDto {
  idExterno:         string;
  titulo:            string;
  tipo:              'SERVICIO' | 'INVESTIGACION';
  responsableNombre: string;
  responsableEmail:  string;
  vacantesTotal:     number;
  convocatoriaId:    string;
  dependencia?:      string;
  especialidades?:   string;
  periodo?:          string;
  horario?:          string;
  objetivo?:         string;
  tareas?:           string;
  observaciones?:    string;
  reqRegularizadas?: string;
  reqAprobadas?:     string;
  reqOtros?:         string;
  modulos?:          number;
}

export const propuestasService = {
  /** GET /propuestas?convocatoriaId=&page=&limit=&q= (paginado + búsqueda) */
  listar: (convocatoriaId: string, page = 1, limit = 50, q?: string) => {
    const params = new URLSearchParams({
      convocatoriaId,
      page: String(page),
      limit: String(limit),
    });
    if (q) params.set('q', q);
    return http.get<PropuestasPage>(`/propuestas?${params}`);
  },

  /** GET /propuestas/:id */
  obtener: (id: string) =>
    http.get<Propuesta>(`/propuestas/${id}`),

  /** POST /propuestas */
  crear: (dto: CreatePropuestaDto) =>
    http.post<Propuesta>('/propuestas', dto),

  /** POST /propuestas/:id/publicar */
  publicar: (id: string) =>
    http.post<Propuesta>(`/propuestas/${id}/publicar`),

  /** PUT /propuestas/:id/vacantes */
  actualizarVacantes: (id: string, vacantesTotal: number) =>
    http.put<Propuesta>(`/propuestas/${id}/vacantes`, { vacantesTotal }),

  /** POST /propuestas/importar-xls?convocatoriaId= — solicitudes XLS */
  importarXls: (
    convocatoriaId: string,
    file: File,
    onProgress?: (pct: number) => void,
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    return http.upload<{ importadas: number }>(
      `/propuestas/importar-xls?convocatoriaId=${convocatoriaId}`,
      formData,
      onProgress,
    );
  },
};
