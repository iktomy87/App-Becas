import { useState, useEffect } from 'react';
import { convocatoriasService } from '../services/convocatorias.service';
import { rankingService }       from '../services/ranking.service';
import { importacionService }   from '../services/importacion.service';
import type { Convocatoria, ResultadoRanking, CargaPlanilla } from '../services/types';

export interface PanelState {
  convocatoria:  Convocatoria | null;
  ranking:       ResultadoRanking[];
  rankingTotal:  number;
  cargas:        CargaPlanilla[];
  loading:       boolean;
  error:         string | null;
  /** Recarga todos los datos del panel */
  refresh:       () => void;
  /** Sube una planilla y refresca */
  cargarPlanilla: (file: File) => Promise<CargaPlanilla>;
  /** Sube un padrón y refresca */
  cargarPadron: (file: File) => Promise<any>;
}

/**
 * Hook principal del Panel.
 * Carga la convocatoria más reciente en estado ABIERTA y sus datos relacionados.
 */
export function usePanelPrincipal(): PanelState {
  const [convocatoria, setConvocatoria] = useState<Convocatoria | null>(null);
  const [ranking, setRanking]           = useState<ResultadoRanking[]>([]);
  const [rankingTotal, setRankingTotal] = useState(0);
  const [cargas, setCargas]             = useState<CargaPlanilla[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [tick, setTick]                 = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // 1. Obtener todas las convocatorias y usar la primera ABIERTA
        const convocatorias = await convocatoriasService.listar();
        const activa = convocatorias.find(
          (c) => c.estado === 'ABIERTA' || c.estado === 'EN_RANKING',
        ) ?? convocatorias[0] ?? null;

        if (cancelled) return;
        setConvocatoria(activa);

        if (!activa) {
          setLoading(false);
          return;
        }

        // 2. Cargar ranking y planillas en paralelo
        const [rankingPage, cargasList] = await Promise.all([
          rankingService.listar(activa.id, 1, 50).catch(() => ({ data: [], total: 0, page: 1, limit: 50 })),
          importacionService.listar(activa.id).catch(() => [] as CargaPlanilla[]),
        ]);

        if (cancelled) return;
        setRanking(Array.isArray(rankingPage.data) ? rankingPage.data : (Array.isArray(rankingPage) ? rankingPage : []));
        setRankingTotal(rankingPage.total || (Array.isArray(rankingPage) ? rankingPage.length : 0));
        setCargas(Array.isArray(cargasList) ? cargasList : []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error al cargar los datos');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [tick]);

  function refresh() { setTick((t) => t + 1); }

  async function cargarPlanilla(file: File) {
    let targetId = convocatoria?.id;

    // Si no hay convocatoria activa, creamos una automáticamente para iniciar el proceso
    if (!targetId) {
      const now = new Date();
      const nextMonth = new Date(now);
      nextMonth.setMonth(now.getMonth() + 1);

      const nuevaConv = await convocatoriasService.crear({
        nombre: `Convocatoria ${now.getFullYear()}`,
        fechaApertura: now.toISOString(),
        fechaCierre: nextMonth.toISOString(),
      });
      targetId = nuevaConv.id;
    }

    const res = await importacionService.cargar(targetId, file);
    refresh();
    return res;
  }

  async function cargarPadron(file: File) {
    let targetId = convocatoria?.id;

    if (!targetId) {
      const now = new Date();
      const nextMonth = new Date(now);
      nextMonth.setMonth(now.getMonth() + 1);

      const nuevaConv = await convocatoriasService.crear({
        nombre: `Convocatoria ${now.getFullYear()}`,
        fechaApertura: now.toISOString(),
        fechaCierre: nextMonth.toISOString(),
      });
      targetId = nuevaConv.id;
    }

    const res = await importacionService.cargarPadron(targetId, file);
    refresh();
    return res;
  }

  return { convocatoria, ranking, rankingTotal, cargas, loading, error, refresh, cargarPlanilla, cargarPadron };
}

