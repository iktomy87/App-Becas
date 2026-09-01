import { Response } from 'express';
import { ReportesService } from './reportes.service';
export declare class ReportesController {
    private readonly service;
    constructor(service: ReportesService);
    descargarAsignacion(convocatoriaId: string, res: Response): Promise<void>;
}
