import { http } from './http';
import type { Convocatoria, CreateConvocatoriaDto, UpdateConvocatoriaDto } from './types';

export const convocatoriasService = {
  /** GET /convocatorias */
  listar: () =>
    http.get<Convocatoria[]>('/convocatorias'),

  /** GET /convocatorias/:id */
  obtener: (id: string) =>
    http.get<Convocatoria>(`/convocatorias/${id}`),

  /** POST /convocatorias */
  crear: (dto: CreateConvocatoriaDto) =>
    http.post<Convocatoria>('/convocatorias', dto),

  /** PUT /convocatorias/:id */
  actualizar: (id: string, dto: UpdateConvocatoriaDto) =>
    http.put<Convocatoria>(`/convocatorias/${id}`, dto),

  /** POST /convocatorias/:id/cierre */
  cerrar: (id: string) =>
    http.post<Convocatoria>(`/convocatorias/${id}/cierre`),

  /** POST /convocatorias/:id/cerrar-y-asignar  (Facade completo) */
  cerrarYAsignar: (id: string) =>
    http.post<{ mensaje: string }>(`/convocatorias/${id}/cerrar-y-asignar`),
};

