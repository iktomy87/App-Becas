import { ConvocatoriasService } from './convocatorias.service';
import { CreateConvocatoriaDto, UpdateConvocatoriaDto, CreateRankingConfigDto } from './dto/convocatoria.dto';
export declare class ConvocatoriasController {
    private readonly service;
    constructor(service: ConvocatoriasService);
    findAll(): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        nombre: string;
        fechaApertura: Date;
        fechaCierre: Date;
        estado: import(".prisma/client").$Enums.EstadoConvocatoria;
        createdAt: Date;
    }[]>;
    findOne(id: string): Promise<{
        rankingConfig: {
            id: string;
            nombre: string;
            createdAt: Date;
            convocatoriaId: string;
            minMateriasCursando: number;
            minRegularizadas: number;
            criterioDesempate: string;
            version: number;
            tipo: string;
        };
    } & {
        id: string;
        nombre: string;
        fechaApertura: Date;
        fechaCierre: Date;
        estado: import(".prisma/client").$Enums.EstadoConvocatoria;
        createdAt: Date;
        updatedAt: Date;
    }>;
    create(dto: CreateConvocatoriaDto): import(".prisma/client").Prisma.Prisma__ConvocatoriaClient<{
        id: string;
        nombre: string;
        fechaApertura: Date;
        fechaCierre: Date;
        estado: import(".prisma/client").$Enums.EstadoConvocatoria;
        createdAt: Date;
        updatedAt: Date;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    update(id: string, dto: UpdateConvocatoriaDto): Promise<{
        id: string;
        nombre: string;
        fechaApertura: Date;
        fechaCierre: Date;
        estado: import(".prisma/client").$Enums.EstadoConvocatoria;
        createdAt: Date;
        updatedAt: Date;
    }>;
    cerrar(id: string): Promise<{
        id: string;
        nombre: string;
        fechaApertura: Date;
        fechaCierre: Date;
        estado: import(".prisma/client").$Enums.EstadoConvocatoria;
        createdAt: Date;
        updatedAt: Date;
    }>;
    upsertRankingConfig(id: string, dto: CreateRankingConfigDto): Promise<{
        id: string;
        nombre: string;
        createdAt: Date;
        convocatoriaId: string;
        minMateriasCursando: number;
        minRegularizadas: number;
        criterioDesempate: string;
        version: number;
        tipo: string;
    }>;
}
