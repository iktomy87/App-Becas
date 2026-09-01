import { EstadoConvocatoria } from '@prisma/client';
export declare class CreateConvocatoriaDto {
    nombre: string;
    fechaApertura: string;
    fechaCierre: string;
}
export declare class UpdateConvocatoriaDto {
    nombre?: string;
    fechaApertura?: string;
    fechaCierre?: string;
}
export declare class UpdateEstadoConvocatoriaDto {
    estado: EstadoConvocatoria;
}
export declare class CreateRankingConfigDto {
    minMateriasCursando?: number;
    minRegularizadas?: number;
    criterioDesempate?: string;
}
