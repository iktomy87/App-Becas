import { PadronAcademico } from '@prisma/client';
export interface FilaInscripcion {
    dni: string;
    legajo?: string;
    nombre?: string;
    apellido?: string;
    email?: string;
    carrera?: string;
    promedio?: number;
    aprobadas?: number;
    cursadas?: number;
    aplazos?: number;
    preferencias: {
        idPropuesta: string;
        orden: number;
    }[];
}
export interface ErrorFila {
    fila: number;
    tipo: 'ERROR' | 'ADVERTENCIA' | 'CONFIRMACION_REQUERIDA';
    campo?: string;
    mensaje: string;
    valorPlanilla?: any;
    valorPadron?: any;
}
export interface ResultadoVerificacion {
    valida: boolean;
    requiereConfirmacion: boolean;
    errores: ErrorFila[];
    advertencias: ErrorFila[];
}
export declare function parsearPreferencias(row: any): {
    idPropuesta: string;
    orden: number;
}[];
export declare function verificarFila(rowIndex: number, fila: FilaInscripcion, padron: PadronAcademico | null): ResultadoVerificacion;
