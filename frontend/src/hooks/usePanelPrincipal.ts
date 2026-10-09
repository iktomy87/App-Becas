import { useState, useEffect } from 'react';
import { convocatoriasService } from '../services/convocatorias.service';
import { rankingService }       from '../services/ranking.service';
import { importacionService }   from '../services/importacion.service';
import { seleccionarConvocatoriaActiva } from './convocatoriaActiva';
import type {
  Convocatoria,
  ResultadoRanking,
  CargaPlanilla,
  ProgresoImportacion,
  ResultadoImportacionPadron,
  ResultadoImportacionPlanilla,
} from '../services/types';

export interface PanelState {
  convocatoria:  Convocatoria | null;
  ranking:       ResultadoRanking[];
  rankingTotal:  number;
  cargas:        CargaPlanilla[];
  loading:       boolean;
  error:         string | null;
  /** Recarga todos los datos del panel */
  refresh:       () => void;
  /**
   * Sube una planilla, espera al worker y devuelve el reporte de la carga.
   *
   * Antes declaraba `Promise<CargaPlanilla>` pero devolvía el resultado del job
   * (`ResultadoImportacionPlanilla`), que es otra forma: por eso el consumidor
   * tenía que castear a `any` para leer los errores.
   */
  cargarPlanilla: (file: File) => Promise<ResultadoImportacionPlanilla>;
  /** Sube un padrón, espera al worker y devuelve el conteo de filas. */
  cargarPadron: (file: File) => Promise<ResultadoImportacionPadron>;
  /** Estado del progreso de carga asincrónica */
  uploadProgress: ProgresoImportacion | null;
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
        const activa = seleccionarConvocatoriaActiva(convocatorias);

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
  const [uploadProgress, setUploadProgress] = useState<ProgresoImportacion | null>(null);

  async function cargarPlanilla(file: File): Promise<ResultadoImportacionPlanilla> {
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

    setUploadProgress(null);
    const { jobId } = await importacionService.cargar(targetId, file);

    // El procesamiento es asíncrono: se sondea el job hasta que termina.
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const status = await importacionService.status(targetId, jobId);

      const progreso = status.progress;
      if (progreso && typeof progreso !== 'number' && progreso.rowsProcessed != null) {
        setUploadProgress(progreso);
      }

      if (status.state === 'completed') {
        setUploadProgress(null);
        refresh();
        if (!status.resultado) {
          throw new Error('La importación terminó sin devolver resultado');
        }
        return status.resultado;
      }
      if (status.state === 'failed') {
        setUploadProgress(null);
        throw new Error(status.error || 'La importación falló');
      }
    }
  }

  async function cargarPadron(file: File): Promise<ResultadoImportacionPadron> {
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

    setUploadProgress(null);
    const { jobId } = await importacionService.cargarPadron(targetId, file);

    // Polling mientras el worker procesa el archivo
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const status = await importacionService.statusPadron(targetId, jobId);

      if (status.state === 'completed') {
        setUploadProgress(null);
        refresh();
        if (!status.resultado) {
          throw new Error('El padrón se procesó sin devolver resultado');
        }
        return status.resultado;
      }
      if (status.state === 'failed') {
        setUploadProgress(null);
        throw new Error(status.error || 'El procesamiento del padrón falló');
      }
      // sigue esperando si está en 'waiting' o 'active'
    }
  }

  return { convocatoria, ranking, rankingTotal, cargas, loading, error, refresh, cargarPlanilla, cargarPadron, uploadProgress };
}

