import { TipoPropuesta } from '@prisma/client';
export declare class CreatePropuestaDto {
    idExterno: string;
    titulo: string;
    tipo: TipoPropuesta;
    responsableNombre: string;
    responsableEmail: string;
    vacantesTotal: number;
    convocatoriaId: string;
    dependencia?: string;
    especialidades?: string;
    periodo?: string;
    horario?: string;
    objetivo?: string;
    tareas?: string;
    observaciones?: string;
    reqRegularizadas?: string;
    reqAprobadas?: string;
    reqOtros?: string;
    modulos?: number;
}
export declare class UpdateVacantesDto {
    vacantesTotal: number;
}
