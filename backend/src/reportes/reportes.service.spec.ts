import * as ExcelJS from 'exceljs';
import {
  separarNombre,
  formatoFecha,
  cargaHorariaModulos,
  ReportesService,
} from './reportes.service';

/**
 * El padrón guarda `"Apellido, Nombre"` con las comillas CSV que deja el
 * maestro. `separarNombre` tiene que sacarlas y cortar por la coma (los
 * apellidos compuestos dependen de ese separador), con un fallback al primer
 * token cuando el nombre no viene con coma.
 */
describe('separarNombre', () => {
  it('separa por la coma que deja el maestro (con comillas CSV)', () => {
    expect(separarNombre('"Dalke, Katherina Anyelén"')).toEqual({
      apellido: 'Dalke',
      nombre: 'Katherina Anyelén',
    });
  });

  it('respeta apellidos compuestos', () => {
    expect(separarNombre('"Brizuela Silvestri, Yoel Elián"')).toEqual({
      apellido: 'Brizuela Silvestri',
      nombre: 'Yoel Elián',
    });
  });

  it('soporta el formato sin comillas', () => {
    expect(separarNombre('Correa Sapiega, Luciano Agustin')).toEqual({
      apellido: 'Correa Sapiega',
      nombre: 'Luciano Agustin',
    });
  });

  it('cae al primer token cuando no hay coma', () => {
    expect(separarNombre('Rodríguez Lourdes')).toEqual({
      apellido: 'Rodríguez',
      nombre: 'Lourdes',
    });
  });

  it('tolera valores vacíos', () => {
    expect(separarNombre('')).toEqual({ apellido: '', nombre: '' });
  });
});

describe('formatoFecha', () => {
  it('formatea como dd/mm/aaaa', () => {
    expect(formatoFecha(new Date(2026, 3, 1))).toBe('01/04/2026');
  });

  it('devuelve vacío sin fecha', () => {
    expect(formatoFecha(null)).toBe('');
    expect(formatoFecha(undefined)).toBe('');
  });
});

describe('cargaHorariaModulos', () => {
  it('un módulo son 6hs semanales', () => {
    expect(cargaHorariaModulos(1)).toBe('6hs');
    expect(cargaHorariaModulos(2)).toBe('12hs');
  });

  it('sin módulos usa el default de un módulo', () => {
    expect(cargaHorariaModulos(null)).toBe('6hs');
    expect(cargaHorariaModulos(0)).toBe('6hs');
  });
});

describe('generarReporteRanking', () => {
  it('escribe posición, datos académicos y prioridades', async () => {
    const prisma = {
      resultadoRanking: {
        findMany: jest.fn().mockResolvedValue([
          {
            posicion: 1,
            puntajeTotal: 17.24,
            bonusAntecedentes: 0.5,
            habilitado: true,
            motivoInhabilitacion: null,
            padronId: 'p1',
            padron: {
              dni: '35450612',
              legajo: '17.891',
              nombreCompleto: '"Alvarez hayes, Fernando"',
              especialidadCodigo: 8,
              promedio: 7.8,
              aprobadas: 43,
              regularizadas: 44,
              aplazos: 0,
            },
          },
        ]),
      },
      postulacion: {
        findMany: jest.fn().mockResolvedValue([
          {
            padronId: 'p1',
            ordenPreferencia: 1,
            propuesta: { idExterno: '1103171813528515' },
          },
        ]),
      },
    } as any;
    const storage = {
      uploadBuffer: jest.fn().mockResolvedValue(undefined),
    } as any;

    const buffer = await new ReportesService(
      prisma,
      storage,
    ).generarReporteRanking('c1');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
    const ws = workbook.worksheets[0];

    expect(ws.getRow(1).getCell(1).value).toBe('Posición');
    expect(ws.getRow(2).getCell(2).value).toBe('35450612');
    expect(ws.getRow(2).getCell(3).value).toBe('Alvarez hayes');
    expect(ws.getRow(2).getCell(13).value).toBe(17.24);
    expect(ws.getRow(2).getCell(16).value).toBe('1103171813528515 - prio: 1');
    expect(storage.uploadBuffer).toHaveBeenCalled();
  });
});
