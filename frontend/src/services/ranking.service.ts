import { http } from './http';
import type { RankingPage, ResultadoRanking } from './types';

export const rankingService = {
  /** POST /convocatorias/:convocatoriaId/ranking/calcular */
  calcular: (convocatoriaId: string) =>
    http.post<{ mensaje: string }>(`/convocatorias/${convocatoriaId}/ranking/calcular`),

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

