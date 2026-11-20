import {
  separarNombre,
  formatoFecha,
  cargaHorariaModulos,
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
