import { http } from './http';
import type {
  CargaPlanilla,
  EstadoJob,
  InscripcionesPage,
  ResultadoImportacionPadron,
  ResultadoImportacionPlanilla,
} from './types';


export const importacionService = {
  /** POST /convocatorias/:convocatoriaId/planillas  (multipart) */
  cargar: (convocatoriaId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http.upload<{ jobId: string }>(
      `/convocatorias/${convocatoriaId}/planillas`,
      form,
    );
  },

  /** GET /convocatorias/:convocatoriaId/planilla/status/:jobId */
  status: (convocatoriaId: string, jobId: string) =>
    http.get<EstadoJob<ResultadoImportacionPlanilla>>(
      `/convocatorias/${convocatoriaId}/planilla/status/${jobId}`,
    ),

  /** POST /convocatorias/:convocatoriaId/padron  (multipart) */
  cargarPadron: (convocatoriaId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http.upload<{ jobId: string; mensaje: string }>(
      `/convocatorias/${convocatoriaId}/padron`,
      form,
    );
  },

  /** GET /convocatorias/:convocatoriaId/padron/status/:jobId */
  statusPadron: (convocatoriaId: string, jobId: string) =>
    http.get<EstadoJob<ResultadoImportacionPadron>>(
      `/convocatorias/${convocatoriaId}/padron/status/${jobId}`,
    ),

  /** GET /convocatorias/:convocatoriaId/planillas */
  listar: (convocatoriaId: string) =>
    http.get<CargaPlanilla[]>(`/convocatorias/${convocatoriaId}/planillas`),

  /** GET /convocatorias/:convocatoriaId/planillas/:cargaId */
  obtener: (convocatoriaId: string, cargaId: string) =>
    http.get<CargaPlanilla>(
      `/convocatorias/${convocatoriaId}/planillas/${cargaId}`,
    ),

  /** GET /convocatorias/:convocatoriaId/planillas/inscripciones (paginado) */
  listarInscripciones: (convocatoriaId: string, page = 1, limit = 50) =>
    http.get<InscripcionesPage>(
      `/convocatorias/${convocatoriaId}/planillas/inscripciones?page=${page}&limit=${limit}`,
    ),
};
