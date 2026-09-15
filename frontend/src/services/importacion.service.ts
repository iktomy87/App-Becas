import { http } from './http';
import type { CargaPlanilla } from './types';

export const importacionService = {
  /** POST /convocatorias/:convocatoriaId/planillas  (multipart) */
  cargar: (convocatoriaId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http.upload<{ jobId?: string } | CargaPlanilla>(`/convocatorias/${convocatoriaId}/planillas`, form);
  },

  /** GET /convocatorias/:convocatoriaId/planilla/status/:jobId */
  status: (convocatoriaId: string, jobId: string) =>
    http.get<{ state: string; progress: any; resultado?: any; error?: string }>(
      `/convocatorias/${convocatoriaId}/planilla/status/${jobId}`
    ),

  /** POST /convocatorias/:convocatoriaId/padron  (multipart) */
  cargarPadron: (convocatoriaId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http.upload<any>(`/convocatorias/${convocatoriaId}/padron`, form);
  },

  /** GET /convocatorias/:convocatoriaId/planillas */
  listar: (convocatoriaId: string) =>
    http.get<CargaPlanilla[]>(`/convocatorias/${convocatoriaId}/planillas`),

  /** GET /convocatorias/:convocatoriaId/planillas/:cargaId */
  obtener: (convocatoriaId: string, cargaId: string) =>
    http.get<CargaPlanilla>(`/convocatorias/${convocatoriaId}/planillas/${cargaId}`),

  /** GET /convocatorias/:convocatoriaId/planillas/inscripciones */
  listarInscripciones: (convocatoriaId: string) =>
    http.get<any[]>(`/convocatorias/${convocatoriaId}/planillas/inscripciones`),
};

