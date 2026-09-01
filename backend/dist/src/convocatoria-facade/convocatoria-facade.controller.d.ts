import { ConvocatoriaFacadeService } from './convocatoria-facade.service';
export declare class ConvocatoriaFacadeController {
    private readonly facade;
    constructor(facade: ConvocatoriaFacadeService);
    cerrarYAsignar(id: string): Promise<{
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
