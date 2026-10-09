import { http } from './http';
import type { Especialidad } from './types';

export const especialidadesService = {
  /** GET /especialidades — catálogo de carreras (código, nombre, plan). */
  listar: () => http.get<Especialidad[]>('/especialidades'),
};