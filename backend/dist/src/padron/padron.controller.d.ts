import { PadronService } from './padron.service';
export declare class PadronController {
    private readonly service;
    constructor(service: PadronService);
    cargar(convocatoriaId: string, file: Express.Multer.File): Promise<{
        procesadas: number;
        errores: number;
        mensaje: string;
    }>;
}
