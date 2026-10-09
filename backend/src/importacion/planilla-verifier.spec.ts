import {
  verificarFila,
  FilaInscripcion,
  ResultadoVerificacion,
} from './planilla-verifier';
import { PadronAcademico } from '@prisma/client';

/**
 * `verificarFila` es la única fuente de la decisión "esta fila se importa o no".
 * Estos tests fijan ese contrato, en especial el caso del estado de padrón, que
 * antes se reportaba como CONFIRMACION_REQUERIDA y luego el service descartaba
 * igual, en silencio y fuera de todo conteo.
 */

const padronBase = {
  id: 'p1',
  legajo: 1001,
  promedio: 8.5,
  aprobadas: 20,
  cursando: 4,
  regularizadas: 3,
  aplazos: 0,
  estado: 'Activo',
  especialidad: 'ISI',
} as unknown as PadronAcademico;

const filaBase: FilaInscripcion = {
  dni: '1128111635975267',
  legajo: '1001',
  nombre: 'Ana',
  apellido: 'Pérez',
  promedio: 8.5,
  aprobadas: 20,
  cursadas: 24,
  aplazos: 0,
  preferencias: [{ idPropuesta: 'PROP-1', orden: 1 }],
};

const conEstado = (estado: string): PadronAcademico =>
  ({ ...padronBase, estado }) as PadronAcademico;

describe('verificarFila', () => {
  describe('DNI inexistente', () => {
    it('es error y devuelve temprano sin advertencias', () => {
      const r = verificarFila(7, filaBase, null);
      expect(r.valida).toBe(false);
      expect(r.errores).toHaveLength(1);
      expect(r.errores[0]).toMatchObject({
        fila: 7,
        tipo: 'ERROR',
        campo: 'dni',
      });
      expect(r.advertencias).toHaveLength(0);
    });
  });

  describe('estado de padrón distinto de "Activo"', () => {
    // Es el caso que-la fila se descartaba en silencio. RN-11 sólo excluye las
    // filas que NO superan las validaciones de RF-07, y el estado del padrón no
    // está entre ellas: la fila es válida y se importa.
    it.each(['Graduado', 'Egresado', 'Inactivo', 'Baja', 'activo '])(
      'NO invalida la fila con estado "%s"',
      (estado) => {
        const r = verificarFila(3, filaBase, conEstado(estado));
        expect(r.valida).toBe(true);
        expect(r.errores).toHaveLength(0);
      },
    );

    it('lo reporta como ADVERTENCIA con el valor del padrón', () => {
      const r = verificarFila(3, filaBase, conEstado('Graduado'));
      const aviso = r.advertencias.find((a) => a.campo === 'estado');
      expect(aviso).toBeDefined();
      expect(aviso!.tipo).toBe('ADVERTENCIA');
      expect(aviso!.valorPadron).toBe('Graduado');
    });

    it('el mensaje ya no le pregunta algo al operador que nadie responde', () => {
      const r = verificarFila(3, filaBase, conEstado('Graduado'));
      const aviso = r.advertencias.find((a) => a.campo === 'estado')!;
      expect(aviso.mensaje).not.toContain('¿');
    });

    it('no produce CONFIRMACION_REQUERIDA', () => {
      const r: ResultadoVerificacion = verificarFila(
        3,
        filaBase,
        conEstado('Graduado'),
      );
      expect(r.advertencias.every((a) => a.tipo === 'ADVERTENCIA')).toBe(true);
    });

    it('acepta el estado por defecto, sin importar mayúsculas', () => {
      for (const estado of ['Activo', 'activo', 'ACTIVO']) {
        const r = verificarFila(3, filaBase, conEstado(estado));
        expect(
          r.advertencias.find((a) => a.campo === 'estado'),
        ).toBeUndefined();
      }
    });

    it('no avisa si el estado viene vacío', () => {
      const r = verificarFila(3, filaBase, conEstado(''));
      expect(r.advertencias.find((a) => a.campo === 'estado')).toBeUndefined();
      expect(r.valida).toBe(true);
    });
  });

  describe('preferencias', () => {
    it('sin preferencias es error', () => {
      const r = verificarFila(1, { ...filaBase, preferencias: [] }, padronBase);
      expect(r.valida).toBe(false);
      expect(r.errores[0].campo).toBe('preferencias');
    });

    it('orden duplicado es error', () => {
      const r = verificarFila(
        1,
        {
          ...filaBase,
          preferencias: [
            { idPropuesta: 'A', orden: 1 },
            { idPropuesta: 'B', orden: 1 },
          ],
        },
        padronBase,
      );
      expect(r.valida).toBe(false);
      expect(r.errores[0].mensaje).toContain('duplicado');
    });

    it('más de 5 preferencias es error', () => {
      const r = verificarFila(
        1,
        {
          ...filaBase,
          preferencias: Array.from({ length: 6 }, (_, i) => ({
            idPropuesta: `P${i}`,
            orden: i + 1,
          })),
        },
        padronBase,
      );
      expect(r.valida).toBe(false);
      expect(r.errores[0].mensaje).toContain('Máximo 5');
    });

    it('5 preferencias bien ordenadas es válida', () => {
      const r = verificarFila(
        1,
        {
          ...filaBase,
          preferencias: Array.from({ length: 5 }, (_, i) => ({
            idPropuesta: `P${i}`,
            orden: i + 1,
          })),
        },
        padronBase,
      );
      expect(r.valida).toBe(true);
      expect(r.errores).toHaveLength(0);
    });
  });

  describe('discrepancias entre planilla y padrón', () => {
    it('avisa y mantiene la fila válida', () => {
      const r = verificarFila(5, { ...filaBase, legajo: '9999' }, padronBase);
      expect(r.valida).toBe(true);
      const aviso = r.advertencias.find((a) => a.campo === 'legajo')!;
      // `legajo` es String en el modelo; el resolver normaliza a texto, así que
      // el aviso ya no lo reporta como el número crudo del fixture.
      expect(aviso).toMatchObject({
        valorPlanilla: '9999',
        valorPadron: '1001',
      });
      expect(aviso.mensaje).toContain('se usa el del padrón');
    });

    it('el aviso declara el valor que queda, no promete sólo', () => {
      // Antes el mensaje decía "Se usará el del padrón" sin aplicar nada, así
      // que el puntaje salía con el dato de la planilla.
      const r = verificarFila(5, { ...filaBase, promedio: 8.03 }, {
        ...padronBase,
        promedio: 8,
      } as any);
      expect(r.datos.promedio).toBe(8);
      const aviso = r.advertencias.find((a) => a.campo === 'promedio')!;
      expect(aviso.mensaje).toBe(
        'promedio: planilla "8.03" → padrón "8" — se usa el del padrón.',
      );
    });

    it('no avisa por el legajo si sólo difieren los separadores de miles', () => {
      // Las 177 filas de la planilla real traen el legajo sin puntos y el
      // maestro con puntos: comparar crudo marcaba al 100% de los estudiantes.
      const r = verificarFila(5, { ...filaBase, legajo: '29366' }, {
        ...padronBase,
        legajo: '29.366',
      } as any);
      expect(r.datos.legajo).toBe('29.366');
      expect(r.advertencias.filter((a) => a.campo === 'legajo')).toHaveLength(
        0,
      );
    });

    it('no avisa ni inventa un 0 de aplazos que el maestro no trae', () => {
      // `padron.aplazos` quedó en 0 al quitar el mapeo de `Cant.` (domicilio).
      // El aviso anterior comparaba contra ese 0 y prometía usarlo.
      const r = verificarFila(5, { ...filaBase, aplazos: 1 }, padronBase);
      expect(r.datos.aplazos).toBe(1);
      expect(r.advertencias.filter((a) => a.campo === 'aplazos')).toHaveLength(
        0,
      );
    });

    it('sin discrepancias no genera advertencias', () => {
      const r = verificarFila(5, filaBase, padronBase);
      expect(r.advertencias).toHaveLength(0);
    });
  });
});
