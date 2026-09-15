import { http } from './http';
import type { RankingPage, ResultadoRanking } from './types';

export const rankingService = {
  /** POST /convocatorias/:convocatoriaId/ranking/calcular */
  calcular: (convocatoriaId: string) =>
    http.post<{ mensaje: string }>(`/convocatorias/${convocatoriaId}/ranking/calcular`),

  /** POST /convocatorias/:convocatoriaId/ranking/importar */
  importar: (convocatoriaId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http.upload<{ filasTotal: number; filasValidas: number; filasError: number; errores: any[] }>(`/convocatorias/${convocatoriaId}/ranking/importar`, form);
  },

  /** GET /convocatorias/:convocatoriaId/ranking?page=&limit= */
  listar: (convocatoriaId: string, page = 1, limit = 50) =>
    http.get<RankingPage>(
      `/convocatorias/${convocatoriaId}/ranking?page=${page}&limit=${limit}`,
    ),

  /** GET /convocatorias/:convocatoriaId/ranking/estudiante/:dni */
  getDesglose: (convocatoriaId: string, dni: string) =>
    http.get<ResultadoRanking>(
      `/convocatorias/${convocatoriaId}/ranking/estudiante/${dni}`,
    ),
};

