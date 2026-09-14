import { http } from './http';
import type { CargaPlanilla } from './types';

export const importacionService = {
  /** POST /convocatorias/:convocatoriaId/planillas  (multipart) */
  cargar: (convocatoriaId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http.upload<CargaPlanilla>(`/convocatorias/${convocatoriaId}/planillas`, form);
  },

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

