import type { Prisma } from '@prisma/client';

/**
 * Filtro `OR` para buscar estudiantes por nombre, DNI o legajo
 * (ignore case). Devuelve `undefined` cuando `q` está vacío para que el
 * `where` del llamador quede sin tocar y el query no cambie.
 *
 * Lo usan `getRanking` (a través de la relación `padron`) y
 * `getInscripciones` para la barra de búsqueda de ambas pantallas.
 */
export function whereBusquedaEstudiante(
  q?: string,
): Prisma.PadronAcademicoWhereInput[] | undefined {
  const termino = q?.trim();
  if (!termino) return undefined;
  return [
    { nombreCompleto: { contains: termino, mode: 'insensitive' } },
    { dni: { contains: termino, mode: 'insensitive' } },
    { legajo: { contains: termino, mode: 'insensitive' } },
  ];
}