import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ImportacionService } from './importacion.service';
import { parsearPreferencias, verificarFila } from './planilla-verifier';

/**
 * Cubre la lectura de filas de la planilla: qué se descarta, qué se reporta y
 * cómo se contabiliza. Los tres bugs que fijan estos tests descartaban filas o
 * sumaban contadores sin que nadie se enterara:
 *
 *  - una fila sin DNI se perdía en silencio (ya había sumando a filasTotal, pero
 *    no caía en ningún bucket ni dejaba diagnóstico);
 *  - una celda de preferencia ilegible se ignoraba en silencio;
 *  - las filas de un mismo DNI se fusionaban sin avisar.
 */

type Ctx = {
  contarFila: () => void;
  error: (fila: number, campo: string, mensaje: string) => void;
  advertencia: (
    dni: string,
    fila: number,
    campo: string,
    mensaje: string,
  ) => void;
};

/** Instancia el service sin dependencias: `procesarFila` no toca Prisma. */
function servicio(): any {
  return new ImportacionService(null as any, null as any);
}

function ctxHarness() {
  const c = { filasTotal: 0, errores: [] as any[], advertencias: [] as any[] };
  const ctx: Ctx = {
    contarFila: () => c.filasTotal++,
    error: (fila, campo, mensaje) =>
      c.errores.push({ fila, tipo: 'ERROR', campo, mensaje }),
    advertencia: (dni, fila, campo, mensaje) =>
      c.advertencias.push({ dni, fila, tipo: 'ADVERTENCIA', campo, mensaje }),
  };
  return { c, ctx };
}

describe('parsearPreferencias', () => {
  it('interpreta el formato "<id> - prio: N"', () => {
    const r = parsearPreferencias({
      'Prioridad 1': '1121163026186201 - prio: 1',
      'Prioridad 2': '1123101813509516 - prio: 2',
    });
    expect(r.preferencias).toEqual([
      { idPropuesta: '1121163026186201', orden: 1 },
      { idPropuesta: '1123101813509516', orden: 2 },
    ]);
    expect(r.invalidas).toHaveLength(0);
  });

  it('una celda vacía no es un error', () => {
    const r = parsearPreferencias({
      'Prioridad 1': '',
      'Prioridad 2': '   ',
      'Prioridad 3': null,
    });
    expect(r.preferencias).toHaveLength(0);
    expect(r.invalidas).toHaveLength(0);
  });

  it('una celda presente pero ilegible se reporta, con columna y valor', () => {
    const r = parsearPreferencias({ 'Prioridad 2': 'no sé qué es esto' });
    expect(r.preferencias).toHaveLength(0);
    expect(r.invalidas).toEqual([
      expect.objectContaining({
        columna: 'Prioridad 2',
        valor: 'no sé qué es esto',
      }),
    ]);
  });

  it('mezcla las legibles y las ilegibles sin perder ninguna', () => {
    const r = parsearPreferencias({
      'Prioridad 1': 'AAA - prio: 1',
      'Prioridad 2': 'basura',
      'Prioridad 3': 'BBB - prio: 3',
    });
    expect(r.preferencias.map((p) => p.orden)).toEqual([1, 3]);
    expect(r.invalidas.map((i) => i.columna)).toEqual(['Prioridad 2']);
  });

  it('rechaza un orden de más de un dígito en vez de truncarlo', () => {
    const r = parsearPreferencias({ 'Prioridad 1': 'AAA - prio: 12' });
    expect(r.preferencias).toHaveLength(0);
    expect(r.invalidas).toHaveLength(1);
  });

  it('acepta los tres nombres de columna alternativos', () => {
    for (const col of ['Prioridad 1', 'preferencia_1', 'Postulación 1']) {
      const r = parsearPreferencias({ [col]: 'AAA - prio: 1' });
      expect(r.preferencias).toEqual([{ idPropuesta: 'AAA', orden: 1 }]);
      expect(r.invalidas).toHaveLength(0);
    }
  });
});

describe('procesarFila', () => {
  const fila = (dni: unknown) => ({
    DNI: dni,
    'Prioridad 1': '1121163026186201 - prio: 1',
  });

  it('descarta y REPORTA la fila sin DNI, en vez de perderla en silencio', () => {
    const s = servicio();
    const { c, ctx } = ctxHarness();
    const porEstudiante = new Map();

    s.procesarFila(
      { DNI: '', 'Prioridad 1': 'AAA - prio: 1' },
      7,
      porEstudiante,
      ctx,
    );

    expect(porEstudiante.size).toBe(0);
    expect(c.filasTotal).toBe(1);
    expect(c.errores).toHaveLength(1);
    expect(c.errores[0]).toMatchObject({
      fila: 7,
      tipo: 'ERROR',
      campo: 'dni',
    });
  });

  it('trata "undefined" y "null" como DNI ausente', () => {
    const s = servicio();
    for (const dni of ['undefined', 'null', '   ']) {
      const { c, ctx } = ctxHarness();
      const porEstudiante = new Map();
      s.procesarFila(fila(dni), 2, porEstudiante, ctx);
      expect(porEstudiante.size).toBe(0);
      expect(c.errores).toHaveLength(1);
    }
  });

  it('una fila con preferencia ilegible NO se descarta si tiene otra legible', () => {
    const s = servicio();
    const { c, ctx } = ctxHarness();
    const porEstudiante = new Map();

    s.procesarFila(
      { DNI: '111', 'Prioridad 1': 'AAA - prio: 1', 'Prioridad 2': 'basura' },
      3,
      porEstudiante,
      ctx,
    );

    // El estudiante sigue en el mapa, con la preferencia que sí se pudo leer.
    expect(porEstudiante.size).toBe(1);
    expect(porEstudiante.get('111').fila.preferencias).toEqual([
      { idPropuesta: 'AAA', orden: 1 },
    ]);
    // La celda perdida queda reportada, pero la fila no se cuenta como rechazada:
    // un error de celda no es necesariamente un error de fila.
    expect(c.errores).toHaveLength(1);
    expect(c.errores[0].mensaje).toContain('Prioridad 2');
  });

  it('fusiona filas del mismo DNI y avisa nombrando cuáles', () => {
    const s = servicio();
    const { c, ctx } = ctxHarness();
    const porEstudiante = new Map();

    s.procesarFila(
      { DNI: '111', 'Prioridad 1': 'AAA - prio: 1' },
      2,
      porEstudiante,
      ctx,
    );
    s.procesarFila(
      { DNI: '111', 'Prioridad 1': 'BBB - prio: 2' },
      3,
      porEstudiante,
      ctx,
    );

    expect(porEstudiante.size).toBe(1);
    expect(porEstudiante.get('111').filas).toEqual([2, 3]);
    expect(porEstudiante.get('111').fila.preferencias).toEqual([
      { idPropuesta: 'AAA', orden: 1 },
      { idPropuesta: 'BBB', orden: 2 },
    ]);
    expect(c.advertencias).toHaveLength(1);
    expect(c.advertencias[0]).toMatchObject({
      dni: '111',
      fila: 2,
      campo: 'dni',
    });
    expect(c.advertencias[0].mensaje).toContain('2, 3');
  });

  // El caso real del CSV de orden de mérito: el DNI 46464433 aparece en las
  // filas 81 y 94, con promedios 8 y 7.67, y la MISMA preferencia prio: 1.
  describe('cuando las filas duplicadas se contradicen', () => {
    const f81 = {
      DNI: '46464433',
      Promedio: '8',
      Aprobadas: '17',
      Cursadas: '17',
      Aplazos: '1',
      'Prioridad 1': '1126094921717521 - prio: 1',
    };
    const f94 = {
      DNI: '46464433',
      Promedio: '7.67',
      Aprobadas: '17',
      Cursadas: '17',
      Aplazos: '1',
      'Prioridad 1': '1126094921717521 - prio: 1',
    };

    it('no fabrica un error de "orden duplicado" que rechace al estudiante', () => {
      const s = servicio();
      const { ctx } = ctxHarness();
      const porEstudiante = new Map();

      s.procesarFila(f81, 81, porEstudiante, ctx);
      s.procesarFila(f94, 94, porEstudiante, ctx);

      // Una sola preferencia: la repetida no se cuenta dos veces.
      expect(porEstudiante.get('46464433').fila.preferencias).toEqual([
        { idPropuesta: '1126094921717521', orden: 1 },
      ]);
    });

    it('el estudiante resultante pasa verificarFila', () => {
      const s = servicio();
      const { ctx } = ctxHarness();
      const porEstudiante = new Map();

      s.procesarFila(f81, 81, porEstudiante, ctx);
      s.procesarFila(f94, 94, porEstudiante, ctx);

      const e = porEstudiante.get('46464433');
      const r = verificarFila(e.filas[0], e.fila, {
        estado: 'Activo',
        legajo: '29366',
        aprobado: true,
      } as any);
      expect(r.valida).toBe(true);
    });

    it('avisa qué campo se contradice y que valor se conservó', () => {
      const s = servicio();
      const { c, ctx } = ctxHarness();
      const porEstudiante = new Map();

      s.procesarFila(f81, 81, porEstudiante, ctx);
      s.procesarFila(f94, 94, porEstudiante, ctx);

      const aviso = c.advertencias[0].mensaje;
      expect(aviso).toContain('46464433');
      expect(aviso).toContain('81, 94');
      // El Promedio es lo que difiere; el aviso lo nombra con ambos valores.
      expect(aviso).toContain('Promedio');
      expect(aviso).toContain('7.67');
      expect(aviso).toContain('fila 81');
      // Y clarify que la prioridad repetida se contó una sola vez.
      expect(aviso).toContain('prioridad 1');
    });

    it('conserva los datos de la primera fila', () => {
      const s = servicio();
      const { ctx } = ctxHarness();
      const porEstudiante = new Map();

      s.procesarFila(f81, 81, porEstudiante, ctx);
      s.procesarFila(f94, 94, porEstudiante, ctx);

      expect(porEstudiante.get('46464433').fila.promedio).toBe(8);
    });
  });

  it('no avisa por una fila que no es duplicada', () => {
    const s = servicio();
    const { c, ctx } = ctxHarness();
    const porEstudiante = new Map();

    s.procesarFila(fila('111'), 2, porEstudiante, ctx);
    s.procesarFila(fila('222'), 3, porEstudiante, ctx);

    expect(porEstudiante.size).toBe(2);
    expect(c.advertencias).toHaveLength(0);
    expect(c.errores).toHaveLength(0);
  });

  it('cuenta cada fila leída una sola vez, aunque se descarte', () => {
    const s = servicio();
    const { c, ctx } = ctxHarness();
    const porEstudiante = new Map();

    s.procesarFila(fila('111'), 2, porEstudiante, ctx);
    s.procesarFila(fila('111'), 3, porEstudiante, ctx);
    s.procesarFila({ DNI: '' }, 4, porEstudiante, ctx);

    expect(c.filasTotal).toBe(3);
  });
});

describe('procesarCsvStreaming — numeración de filas', () => {
  let tmp: string;

  beforeAll(() => {
    tmp = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'planilla-')),
      'p.csv',
    );
    fs.writeFileSync(
      tmp,
      'DNI,Prioridad 1\n' +
        '111,AAA - prio: 1\n' +
        '222,BBB - prio: 1\n' +
        '333,CCC - prio: 1\n',
    );
  });

  afterAll(() =>
    fs.rmSync(path.dirname(tmp), { recursive: true, force: true }),
  );

  it('reporta el número de línea físico de cada fila de datos', async () => {
    const s = servicio();
    const filas: number[] = [];
    let header: string[] | null = null;

    await s.procesarCsvStreaming(
      tmp,
      (raw: any, idx: number, isHeader: boolean) => {
        if (isHeader) {
          header = raw;
          return;
        }
        filas.push(idx);
      },
    );

    expect(header).toEqual(['DNI', 'Prioridad 1']);
    // La 1ª fila de datos es la LÍNEA 2 del archivo. Antes se reportaba como 3.
    expect(filas).toEqual([2, 3, 4]);
  });

  it('el DNI reportado coincide con la línea que lo contiene', async () => {
    const s = servicio();
    const vistos: { dni: string; linea: number }[] = [];

    await s.procesarCsvStreaming(
      tmp,
      (raw: any, idx: number, isHeader: boolean) => {
        if (!isHeader) vistos.push({ dni: raw.DNI, linea: idx });
      },
    );

    // Contrastado contra el archivo: línea 2 -> "111", línea 4 -> "333".
    const lineas = fs.readFileSync(tmp, 'utf8').split('\n');
    for (const v of vistos) {
      expect(lineas[v.linea - 1]).toContain(v.dni);
    }
    expect(vistos).toHaveLength(3);
  });
});
