/**
 * Catálogo de especialidades — fuente única de verdad.
 *
 * Antes esta información estaba duplicada y contradicha en tres lugares:
 *   - `CARRERA_MAP` hardcodeado en `frontend/src/pages/InscripcionesPage.tsx`
 *     (código numérico → nombre)
 *   - `ranking-v1.strategy.ts` (código 1 → 42 materias, nunca se disparaba)
 *   - el nombre de carrera en texto del archivo de orden de mérito (`Carrera`)
 *
 * Ahora conviven las tres dimensiones en una sola tabla y el frontend la
 * consume por HTTP, así que no puede quedar desactualizada.
 *
 * `materiasDelPlan` se usa SOLO como fallback, y en los dos caminos donde no
 * hay columna `Mat. de la carrera`:
 *   - `ranking.service.ts` `calcularRanking`, sin archivo de orden de mérito:
 *     cae al default de 45 y avisa por log.
 *   - `ranking.service.ts` `importarRanking`, si a esa fila le falta la
 *     columna: sin código en el catálogo la fila se descarta en vez de
 *     calcular un factor con un denominador inventado.
 * Si se importa el archivo, su columna `Mat. de la carrera` manda siempre.
 */
export interface Especialidad {
  /** Columna `Esp.` del padrón maestro. */
  codigo: number;
  /**
   * Columna `Carrera` del archivo de orden de mérito.
   *
   * No es única: `ISI` corresponde a los códigos 5 y 85. Lo que sí tiene que
   * coincidir entre los códigos que comparten nombre es `materiasDelPlan`,
   * porque el nombre es lo que muestra la pantalla y el total es lo que
   * divide el puntaje; si se separaran, la pantalla mentiría sobre el
   * denominador.
   */
  nombre: string;
  /** Materias del plan — columna `Mat. de la carrera`. */
  materiasDelPlan: number;
}

/**
 * Los valores de `materiasDelPlan` están verificados contra las 177 filas de
 * `csv/Datos orden de mérito BIS 2026.xlsx - RANKING.csv`, cruzando el `Esp.`
 * del maestro con la columna `Mat. de la carrera` de la planilla:
 *
 *   Esp.  5 → 42 (ISI)    Esp. 27 → 45 (IQ)    Esp. 42 → 18 (TUM)
 *   Esp.  8 → 45 (IEM)    Esp. 34 → 18 (TUP)    Esp. 84 → 36 (LAR)
 *   Esp. 85 → 42 (ISI)
 *
 * Los `codigo` vienen del `CARRERA_MAP` que estaba en el frontend, más el 85
 * agregado con el maestro real. El maestro tiene 43 códigos de especialidad
 * distintos y sólo 7 aparecen en la planilla de 2026: los otros 36 no se
 * pueden verificar contra ese archivo, así que no están en el catálogo. Si
 * alguno hace falta, hay que confirmar el total de materias de su plan contra
 * el orden de mérito y agregarlo acá, que es el único lugar donde vive.
 */
export const ESPECIALIDADES: readonly Especialidad[] = Object.freeze([
  { codigo: 5, nombre: 'ISI', materiasDelPlan: 42 },
  { codigo: 8, nombre: 'IEM', materiasDelPlan: 45 },
  { codigo: 27, nombre: 'IQ', materiasDelPlan: 45 },
  { codigo: 34, nombre: 'TUP', materiasDelPlan: 18 },
  { codigo: 42, nombre: 'TUM', materiasDelPlan: 18 },
  { codigo: 84, nombre: 'LAR', materiasDelPlan: 36 },
  // El 85 no estaba en el `CARRERA_MAP` del frontend pero sí en el padrón
  // maestro (400 alumnos). La planilla de 2026 lo identifica como ISI con 42
  // materias, igual que el código 5: es el mismo plan bajo otro código, no una
  // carrera distinta. Ver `POR_NOMBRE` más abajo para por qué el nombre puede
  // repetirse y qué se hace en ese caso.
  { codigo: 85, nombre: 'ISI', materiasDelPlan: 42 },
]);

/** Materias del plan asumidas cuando la especialidad no está en el catálogo. */
export const MATERIAS_PLAN_POR_DEFECTO = 45;

const POR_CODIGO = new Map<number, Especialidad>(
  ESPECIALIDADES.map((e) => [e.codigo, e]),
);

/**
 * Búsqueda por nombre, del texto de la planilla (`Carrera`) al código.
 *
 * Un nombre puede tener más de un código: `ISI` es el 5 y el 85. `new Map`
 * conserva el último insertado, así que con el catálogo como está —5 antes que
 * 85— 'ISI' resuelve a 85 y los 77 alumnos del código 5 quedan con el plan del
 * otro. No se resuelve ordenando y confiando en eso, sino guardando el código
 * más bajo al momento de armar el mapa. Determinista e independiente del orden
 * en que se escriba la lista.
 */
const POR_NOMBRE = new Map<string, Especialidad>();
for (const e of ESPECIALIDADES) {
  const clave = e.nombre.toUpperCase();
  const yaGuardada = POR_NOMBRE.get(clave);
  if (yaGuardada === undefined || e.codigo < yaGuardada.codigo) {
    POR_NOMBRE.set(clave, e);
  }
}

export function especialidadPorCodigo(
  codigo: number | null | undefined,
): Especialidad | null {
  if (codigo == null) return null;
  return POR_CODIGO.get(codigo) ?? null;
}

/**
 * Acepta el nombre en cualquier caja y con espacios alrededor.
 *
 * Si el nombre corresponde a varios códigos, devuelve el de menor código.
 * Ver `POR_NOMBRE`.
 */
export function especialidadPorNombre(
  nombre: string | null | undefined,
): Especialidad | null {
  if (!nombre) return null;
  return POR_NOMBRE.get(nombre.trim().toUpperCase()) ?? null;
}

/**
 * Materias del plan para un código de especialidad.
 * Devuelve `null` si la especialidad no está en el catálogo, para que el
 * llamador decida si es un error o puede seguir con el default.
 */
export function materiasDelPlanPorCodigo(
  codigo: number | null | undefined,
): number | null {
  return especialidadPorCodigo(codigo)?.materiasDelPlan ?? null;
}

/** Nombre legible de una especialidad, o `Esp. <código>` si no está en el catálogo. */
export function nombreEspecialidad(
  codigo: number | null | undefined,
): string | null {
  if (codigo == null) return null;
  return especialidadPorCodigo(codigo)?.nombre ?? `Esp. ${codigo}`;
}
