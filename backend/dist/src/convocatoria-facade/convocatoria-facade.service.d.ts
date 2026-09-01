import { RankingService } from '../ranking/ranking.service';
import { AsignacionEngineService } from '../asignacion/asignacion-engine.service';
import { ConvocatoriasService } from '../convocatorias/convocatorias.service';
export declare class ConvocatoriaFacadeService {
    private readonly convService;
    private readonly rankingService;
    private readonly asignacionEngine;
    constructor(convService: ConvocatoriasService, rankingService: RankingService, asignacionEngine: AsignacionEngineService);
    cerrarYAsignar(convocatoriaId: string): Promise<{
        mensaje: string;
        ranking: {
            calculados: number;
            inhabilitados: number;
        };
        asignacion: {
            corridaId: string;
            asignados: number;
            noAsignados: number;
        };
    }>;
}
