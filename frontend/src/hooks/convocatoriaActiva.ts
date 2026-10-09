import type { Convocatoria } from '../services/types';

/**
 * Elige la convocatoria sobre la que operan las pantallas.
 *
 * Regla: la primera ABIERTA o EN_RANKING; si no hay ninguna, la primera de la
 * lista; si la lista está vacía, `null`.
 *
 * Vive acá y no en cada página porque la regla estaba duplicada: el panel la
 * aplicaba bien, pero `RankingPage` la había reemplazado por un UUID
 * hardcodeado que no existía en la base. Eso no daba error — la API respondía
 * 200 con `data: []` — así que `/ranking` mostraba "no hay resultados" para
 * siempre y el fallo era indistinguible de "todavía no se cargó nada".
 */
export function seleccionarConvocatoriaActiva(
  convocatorias: Convocatoria[],
): Convocatoria | null {
  return (
    convocatorias.find(
      (c) => c.estado === 'ABIERTA' || c.estado === 'EN_RANKING',
    ) ??
    convocatorias[0] ??
    null
  );
}
