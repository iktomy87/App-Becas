import { RankingV1Strategy } from './ranking-v1.strategy';
import { DatosPuntaje } from './ranking.strategy';

describe('RankingV1Strategy', () => {
  let strategy: RankingV1Strategy;

  beforeEach(() => {
    strategy = new RankingV1Strategy();
  });

  // Fila real de `csv/Datos orden de mérito BIS 2026.xlsx - RANKING.csv`
  // (DNI 40501524). La columna `Factor` del archivo dice 17.30.
  const filaOficial: DatosPuntaje = {
    promedio: 8.03,
    aprobadas: 42,
    cursadas: 46,
    totalMateriasPlan: 45,
    aplazos: 0,
    bonusAntecedentes: 0,
  };

  describe('regresión #1 — totalMateriasPlan no es un bonus', () => {
    it('reproduce el Factor oficial del archivo', () => {
      // 8.03 + 4.20 + (46*3/45) + 2 = 17.2967 → 17.30
      expect(strategy.calcularPuntaje(filaOficial).puntajeTotal).toBeCloseTo(
        17.3,
        2,
      );
    });

    it('el total de materias del plan NO se suma como puntos', () => {
      const d = strategy.calcularPuntaje(filaOficial);
      // Si el bug estuviera presente, puntajeTotal sería 17.30 + 45 = 62.30.
      expect(d.puntajeTotal).toBeLessThan(20);
      expect(d.puntajeTotal).not.toBeCloseTo(
        d.puntajeTotal - filaOficial.totalMateriasPlan,
        5,
      );
    });

    it('el total del plan sólo aparece como denominador del término de avance', () => {
      const con45 = strategy.calcularPuntaje({
        ...filaOficial,
        totalMateriasPlan: 45,
      });
      const con90 = strategy.calcularPuntaje({
        ...filaOficial,
        totalMateriasPlan: 90,
      });
      // Duplicar el denominador reduce el término, no cambia el resto.
      expect(con90.terminoAvance).toBeCloseTo(con45.terminoAvance / 2, 10);
      expect(con90.terminoPromedio).toBe(con45.terminoPromedio);
      expect(con90.terminoAprobadas).toBe(con45.terminoAprobadas);
      expect(con90.terminoAplazos).toBe(con45.terminoAplazos);
    });
  });

  describe('regresión #2 — el avance usa `cursadas`, no `regularizadas`', () => {
    it('el término de avance sale del numerador `cursadas`', () => {
      const d = strategy.calcularPuntaje(filaOficial);
      expect(d.terminoAvance).toBeCloseTo((46 * 3) / 45, 10);
    });

    it('cambiar `cursadas` mueve el puntaje (el campo no es ignorado)', () => {
      const base = strategy.calcularPuntaje(filaOficial).puntajeTotal;
      const mas = strategy.calcularPuntaje({
        ...filaOficial,
        cursadas: 50,
      }).puntajeTotal;
      expect(mas).toBeGreaterThan(base);
      expect(mas - base).toBeCloseTo(((50 - 46) * 3) / 45, 10);
    });
  });

  describe('bonus de antecedentes', () => {
    it('se suma exactamente una vez', () => {
      const sinBonus = strategy.calcularPuntaje({
        ...filaOficial,
        bonusAntecedentes: 0,
      });
      const conBonus = strategy.calcularPuntaje({
        ...filaOficial,
        bonusAntecedentes: 0.5,
      });
      expect(conBonus.bonusAntecedentes).toBe(0.5);
      expect(conBonus.puntajeTotal - sinBonus.puntajeTotal).toBeCloseTo(
        0.5,
        10,
      );
    });

    it('es opcional y equivale a 0 si no se pasa', () => {
      const sinCampo: DatosPuntaje = {
        promedio: filaOficial.promedio,
        aprobadas: filaOficial.aprobadas,
        cursadas: filaOficial.cursadas,
        totalMateriasPlan: filaOficial.totalMateriasPlan,
        aplazos: filaOficial.aplazos,
      };
      expect(strategy.calcularPuntaje(sinCampo).puntajeTotal).toBeCloseTo(
        strategy.calcularPuntaje({ ...filaOficial, bonusAntecedentes: 0 })
          .puntajeTotal,
        10,
      );
    });
  });

  describe('fórmula base', () => {
    it('el desglose suma exactamente al total', () => {
      const d = strategy.calcularPuntaje(filaOficial);
      expect(d.puntajeTotal).toBeCloseTo(
        d.terminoPromedio +
          d.terminoAprobadas +
          d.terminoAvance +
          d.terminoAplazos +
          d.bonusAntecedentes,
        10,
      );
    });

    it('penalización de aplazos no lineal: 2/(1+aplazos)', () => {
      expect(
        strategy.calcularPuntaje({ ...filaOficial, aplazos: 0 }).terminoAplazos,
      ).toBeCloseTo(2, 10);
      expect(
        strategy.calcularPuntaje({ ...filaOficial, aplazos: 1 }).terminoAplazos,
      ).toBeCloseTo(1, 10);
      expect(
        strategy.calcularPuntaje({ ...filaOficial, aplazos: 3 }).terminoAplazos,
      ).toBeCloseTo(0.5, 10);
    });

    it('un plan de 0 materias no divide por cero', () => {
      const d = strategy.calcularPuntaje({
        ...filaOficial,
        totalMateriasPlan: 0,
      });
      expect(d.terminoAvance).toBe(0);
      expect(Number.isFinite(d.puntajeTotal)).toBe(true);
    });

    it('un valor no numérico no contamina el puntaje', () => {
      const d = strategy.calcularPuntaje({
        ...filaOficial,
        promedio: NaN,
        cursadas: NaN,
      });
      expect(d.terminoPromedio).toBe(0);
      expect(d.terminoAvance).toBe(0);
    });
  });
});
