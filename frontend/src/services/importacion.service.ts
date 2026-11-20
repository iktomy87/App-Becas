import { http } from './http';
import type {
  CargaPlanilla,
  EstadoJob,
  InscripcionesPage,
  ResultadoImportacionPadron,
  ResultadoImportacionPlanilla,
} from './types';

export const importacionService = {
  cargar: async (convocatoriaId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return http.upload<{ jobId: string }>(
      `/convocatorias/${convocatoriaId}/planillas`,
      formData,
    );
  },

  status: (convocatoriaId: string, jobId: string) =>
    http.get<EstadoJob<ResultadoImportacionPlanilla>>(
      `/convocatorias/${convocatoriaId}/planilla/status/${jobId}`,
    ),

  cargarPadron: async (convocatoriaId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return http.upload<{ jobId: string; mensaje: string }>(
      `/convocatorias/${convocatoriaId}/padron`,
      formData,
    );
  },

  statusPadron: (convocatoriaId: string, jobId: string) =>
    http.get<EstadoJob<ResultadoImportacionPadron>>(
      `/convocatorias/${convocatoriaId}/padron/status/${jobId}`,
    ),

  listar: (convocatoriaId: string) =>
    http.get<CargaPlanilla[]>(`/convocatorias/${convocatoriaId}/planillas`),

  obtener: (convocatoriaId: string, cargaId: string) =>
    http.get<CargaPlanilla>(
      `/convocatorias/${convocatoriaId}/planillas/${cargaId}`,
    ),

  listarInscripciones: (
    convocatoriaId: string,
    page = 1,
    limit = 50,
    q?: string,
    carrera?: string,
  ) => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (q) params.set('q', q);
    if (carrera) params.set('carrera', carrera);
    return http.get<InscripcionesPage>(
      `/convocatorias/${convocatoriaId}/planillas/inscripciones?${params}`,
    );
  },
};
