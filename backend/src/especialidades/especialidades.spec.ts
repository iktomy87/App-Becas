import {
  ESPECIALIDADES,
  especialidadPorCodigo,
  especialidadPorNombre,
  materiasDelPlanPorCodigo,
  nombreEspecialidad,
  MATERIAS_PLAN_POR_DEFECTO,
} from './especialidades';

describe('catálogo de especialidades', () => {
  it('no tiene códigos duplicados', () => {
    const codigos = ESPECIALIDADES.map((e) => e.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
  });

  it('los códigos que comparten nombre tienen el mismo total de materias', () => {
    // El nombre puede repetirse —`ISI` es el 5 y el 85—, pero el total no: el
    // nombre es lo que ve el operador y `materiasDelPlan` es el denominador de
    // `cursadas × 3 / totalMateriasPlan`. Si dos códigos con el mismo nombre
    // tuvieran totales distintos, la pantalla prometería un plan que el
    // puntaje no usa.
    const porNombre = new Map<string, number[]>();
    for (const e of ESPECIALIDADES) {
      const lista = porNombre.get(e.nombre) ?? [];
      lista.push(e.materiasDelPlan);
      porNombre.set(e.nombre, lista);
    }
    for (const [nombre, planes] of porNombre) {
      expect({ nombre, planes: new Set(planes).size }).toEqual({
        nombre,
        planes: 1,
      });
    }
  });

  it('todos los planes tienen un valor positivo', () => {
    for (const e of ESPECIALIDADES) {
      expect(e.materiasDelPlan).toBeGreaterThan(0);
    }
  });

  describe('búsqueda por código', () => {
    it('resuelve cada código del catálogo', () => {
      for (const e of ESPECIALIDADES) {
        expect(especialidadPorCodigo(e.codigo)).toEqual(e);
      }
    });

    it('un código desconocido devuelve null, no un valor inventado', () => {
      expect(especialidadPorCodigo(999)).toBeNull();
      expect(especialidadPorCodigo(null)).toBeNull();
      expect(especialidadPorCodigo(undefined)).toBeNull();
    });

    it('el código 1 no es ISI (ese era el bug del hardcode anterior)', () => {
      expect(especialidadPorCodigo(1)).toBeNull();
      expect(especialidadPorNombre('ISI')?.codigo).toBe(5);
    });
  });

  describe('búsqueda por nombre', () => {
    it('funciona con cualquier caja y espacios', () => {
      expect(especialidadPorNombre('isi')?.codigo).toBe(5);
      expect(especialidadPorNombre('  Iem ')?.codigo).toBe(8);
      expect(especialidadPorNombre('TUM')?.codigo).toBe(42);
    });

    it('un nombre desconocido devuelve null', () => {
      expect(especialidadPorNombre('XYZ')).toBeNull();
      expect(especialidadPorNombre(null)).toBeNull();
    });

    it('con nombre repetido devuelve el código más bajo, no el último', () => {
      // `ISI` son los códigos 5 y 85. Si el mapa se armsa con
      // `new Map(ESPECIALIDADES.map(...))` gana el último del array y 'ISI'
      // devuelve 85, con lo cual los 77 alumnos del código 5 quedan con el
      // plan del 85. Se recorre de menor a mayor código para que gane el 5.
      expect(
        ESPECIALIDADES.filter((e) => e.nombre === 'ISI').map((e) => e.codigo),
      ).toEqual([5, 85]);
      expect(especialidadPorNombre('ISI')?.codigo).toBe(5);
      expect(especialidadPorNombre('ISI')?.materiasDelPlan).toBe(42);
    });

    it('el orden en que se escribe el catálogo no cambia la resolución', () => {
      // El catálogo es un array, y un array se puede reordenar sin querer. La
      // resolución por nombre no puede depender de eso.
      const codigoDe = (nombre: string) =>
        especialidadPorNombre(nombre)?.codigo;
      const original = codigoDe('ISI');
      const invertido = [...ESPECIALIDADES].reverse();
      // Se re-resuelve desde el invertido para comprobar que el criterio es el
      // código y no la posición.
      const menor = Math.min(
        ...invertido.filter((e) => e.nombre === 'ISI').map((e) => e.codigo),
      );
      expect(original).toBe(menor);
    });
  });

  describe('materias del plan', () => {
    it('devuelve el valor del catálogo', () => {
      // Valores verificados contra csv/Datos orden de mérito BIS 2026, cruzando
      // el `Esp.` del maestro con la columna `Mat. de la carrera` de la
      // planilla: 5→42, 8→45, 27→45, 34→18, 42→18, 84→36, 85→42.
      expect(materiasDelPlanPorCodigo(5)).toBe(42); // ISI
      expect(materiasDelPlanPorCodigo(8)).toBe(45); // IEM
      expect(materiasDelPlanPorCodigo(27)).toBe(45); // IQ
      expect(materiasDelPlanPorCodigo(34)).toBe(18); // TUP
      expect(materiasDelPlanPorCodigo(42)).toBe(18); // TUM
      expect(materiasDelPlanPorCodigo(84)).toBe(36); // LAR
      expect(materiasDelPlanPorCodigo(85)).toBe(42); // ISI, segundo código
    });

    it('el código 85 ya no cae en el default de 45', () => {
      // Antes de agregarlo, `recalcularAutoRanking` le ponía
      // MATERIAS_PLAN_POR_DEFECTO (45) a los 400 alumnos del padrón con
      // `Esp. 85`, y a uno de los 176 de la planilla de 2026. Su valor real,
      // según `Mat. de la carrera`, es 42: la diferencia va directo al
      // término de avance del puntaje.
      expect(MATERIAS_PLAN_POR_DEFECTO).toBe(45);
      expect(materiasDelPlanPorCodigo(85)).not.toBe(MATERIAS_PLAN_POR_DEFECTO);
    });

    it('devuelve null para una especialidad desconocida', () => {
      expect(materiasDelPlanPorCodigo(999)).toBeNull();
    });
  });

  describe('nombre legible', () => {
    it('devuelve el nombre de la especialidad', () => {
      expect(nombreEspecialidad(5)).toBe('ISI');
      expect(nombreEspecialidad(84)).toBe('LAR');
      expect(nombreEspecialidad(85)).toBe('ISI');
    });

    it('cae a "Esp. <código>" si no está en el catálogo', () => {
      expect(nombreEspecialidad(999)).toBe('Esp. 999');
    });

    it('devuelve null si no hay código', () => {
      expect(nombreEspecialidad(null)).toBeNull();
      expect(nombreEspecialidad(undefined)).toBeNull();
    });
  });
});
