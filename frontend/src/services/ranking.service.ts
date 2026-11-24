import { http } from './http';
import { API_BASE_URL } from './config';
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

  /** GET /convocatorias/:convocatoriaId/ranking?page=&limit=&q=&carrera= */
  listar: (
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
    return http.get<RankingPage>(
      `/convocatorias/${convocatoriaId}/ranking?${params}`,
    );
  },

  /** GET /convocatorias/:convocatoriaId/ranking/estudiante/:dni */
  getDesglose: (convocatoriaId: string, dni: string) =>
    http.get<ResultadoRanking>(
      `/convocatorias/${convocatoriaId}/ranking/estudiante/${dni}`,
    ),

  /** GET /convocatorias/:convocatoriaId/reportes/ranking → descarga Excel */
  descargarPlanilla: async (convocatoriaId: string) => {
    const res = await fetch(
      `${API_BASE_URL}/convocatorias/${convocatoriaId}/reportes/ranking`,
    );
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(
        body?.message ?? `No se pudo generar la planilla (${res.status})`,
      );
    }

    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = 'reporte_ranking.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  },
};

