import { ConflictException, NotFoundException } from '@nestjs/common';
import { AsignacionEngineService } from './asignacion-engine.service';

/**
 * Tests de `removerAsignacion`: al retirar a un estudiante de su área hay que
 * liberar su vacante y reubicarlo en la primera otra preferencia con cupo; si
 * ninguna tiene, queda NO_ASIGNADO.
 *
 * Se usa un Prisma mock en memoria en lugar de la DB: el foco es la lógica de
 * decisión (orden de preferencias, cupos, exclusión del área actual), no SQL.
 */

interface PostulacionMock {
  propuestaId: string;
  ordenPreferencia: number;
}

interface ConfigMock {
  corrida: { id: string } | null;
  resultado: {
    id: string;
    padronId: string;
    propuestaId: string | null;
    preferenciaSatisfecha: number | null;
    estado: string;
  } | null;
  postulaciones: PostulacionMock[];
  cupos: Record<string, number>;
}

function buildMocks(config: ConfigMock) {
  const cupos = { ...config.cupos };
  // Registra las escrituras para poder afirmar sobre ellas.
  const escrituras: Array<{ model: string; where: any; data: any }> = [];

  const tx = {
    propuesta: {
      findUnique: async ({ where }: any) =>
        where.id in cupos ? { vacantesDisponibles: cupos[where.id] } : null,
      update: async ({ where, data }: any) => {
        const d = data.vacantesDisponibles ?? {};
        if (d.increment) cupos[where.id] += d.increment;
        if (d.decrement) cupos[where.id] -= d.decrement;
        escrituras.push({ model: 'propuesta', where, data });
        return { id: where.id, vacantesDisponibles: cupos[where.id] };
      },
    },
    resultadoAsignacion: {
      update: async ({ where, data }: any) => {
        escrituras.push({ model: 'resultadoAsignacion', where, data });
        return {
          id: where.id,
          ...data,
          propuesta: data.propuestaId
            ? {
                idExterno: 'X',
                titulo: 'T',
                tipo: 'SERVICIO',
                dependencia: 'D',
              }
            : null,
        };
      },
    },
    corridaAsignacion: {
      update: async ({ where, data }: any) => {
        escrituras.push({ model: 'corridaAsignacion', where, data });
        return { id: where.id };
      },
    },
  };

  const prisma = {
    corridaAsignacion: { findFirst: async () => config.corrida },
    resultadoAsignacion: { findFirst: async () => config.resultado },
    postulacion: { findMany: async () => config.postulaciones },
    $transaction: async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
  };

  const events = { emit: jest.fn() };
  const service = new AsignacionEngineService(prisma as any, events as any);

  const escrituraDe = (model: string) =>
    escrituras.find((e) => e.model === model);

  return { service, cupos, escrituras, events, escrituraDe };
}

const RESULTADO_BASE = {
  id: 'r1',
  padronId: 'p1',
  propuestaId: 'area1',
  preferenciaSatisfecha: 1,
  estado: 'ASIGNADO',
};

describe('AsignacionEngineService.removerAsignacion', () => {
  it('reubica en la primera otra preferencia con cupo y libera la vacante del área actual', async () => {
    const { service, cupos, escrituraDe } = buildMocks({
      corrida: { id: 'c1' },
      resultado: { ...RESULTADO_BASE },
      postulaciones: [
        { propuestaId: 'area1', ordenPreferencia: 1 }, // actual
        { propuestaId: 'area2', ordenPreferencia: 2 }, // sin cupo
        { propuestaId: 'area3', ordenPreferencia: 3 }, // con cupo
      ],
      cupos: { area1: 0, area2: 0, area3: 1 },
    });

    const res = await service.removerAsignacion('conv1', 'r1');

    expect(res.estado).toBe('ASIGNADO');
    // No vuelve a la actual aunque quede libre (queda en 1 al liberarla).
    expect(cupos.area1).toBe(1);
    expect(cupos.area3).toBe(0);
    expect(escrituraDe('resultadoAsignacion')?.data).toMatchObject({
      propuestaId: 'area3',
      preferenciaSatisfecha: 3,
      estado: 'ASIGNADO',
    });
    // Reasignado dentro del mismo conjunto: los totales no cambian.
    expect(escrituraDe('corridaAsignacion')).toBeUndefined();
  });

  it('pasa a NO_ASIGNADO cuando ninguna otra preferencia tiene cupo', async () => {
    const { service, cupos, escrituraDe } = buildMocks({
      corrida: { id: 'c1' },
      resultado: { ...RESULTADO_BASE },
      postulaciones: [
        { propuestaId: 'area1', ordenPreferencia: 1 },
        { propuestaId: 'area2', ordenPreferencia: 2 },
      ],
      cupos: { area1: 0, area2: 0 },
    });

    const res = await service.removerAsignacion('conv1', 'r1');

    expect(res.estado).toBe('NO_ASIGNADO');
    // La vacante del área actual igual se libera.
    expect(cupos.area1).toBe(1);
    expect(escrituraDe('resultadoAsignacion')?.data).toMatchObject({
      propuestaId: null,
      preferenciaSatisfecha: null,
      estado: 'NO_ASIGNADO',
    });
    expect(escrituraDe('corridaAsignacion')?.data).toEqual({
      totalAsignados: { decrement: 1 },
      totalNoAsignados: { increment: 1 },
    });
  });

  it('no reubica si no hay otras preferencias (queda NO_ASIGNADO)', async () => {
    const { service, escrituraDe } = buildMocks({
      corrida: { id: 'c1' },
      resultado: { ...RESULTADO_BASE },
      postulaciones: [{ propuestaId: 'area1', ordenPreferencia: 1 }],
      cupos: { area1: 0 },
    });

    const res = await service.removerAsignacion('conv1', 'r1');
    expect(res.estado).toBe('NO_ASIGNADO');
    expect(escrituraDe('corridaAsignacion')).toBeDefined();
  });

  it('rechaza si el estudiante no está asignado', async () => {
    const { service, escrituras } = buildMocks({
      corrida: { id: 'c1' },
      resultado: { ...RESULTADO_BASE, estado: 'NO_ASIGNADO' },
      postulaciones: [],
      cupos: {},
    });

    await expect(
      service.removerAsignacion('conv1', 'r1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(escrituras).toHaveLength(0);
  });

  it('rechaza si no hay corrida vigente', async () => {
    const { service } = buildMocks({
      corrida: null,
      resultado: { ...RESULTADO_BASE },
      postulaciones: [],
      cupos: {},
    });

    await expect(
      service.removerAsignacion('conv1', 'r1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza si el resultado no existe', async () => {
    const { service } = buildMocks({
      corrida: { id: 'c1' },
      resultado: null,
      postulaciones: [],
      cupos: {},
    });

    await expect(
      service.removerAsignacion('conv1', 'r1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
