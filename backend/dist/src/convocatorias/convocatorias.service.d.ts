import { PrismaService } from '../prisma/prisma.service';
import { CreateConvocatoriaDto, UpdateConvocatoriaDto, CreateRankingConfigDto } from './dto/convocatoria.dto';
export declare class ConvocatoriasService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(): import(".prisma/client").Prisma.PrismaPromise<({
        rankingConfig: {
            nombre: string;
            minMateriasCursando: number;
            minRegularizadas: number;
            criterioDesempate: string;
            id: string;
            createdAt: Date;
            convocatoriaId: string;
            version: number;
            tipo: string;
        };
        _count: {
            propuestas: number;
            cargas: number;
        };
    } & {
        nombre: string;
        fechaApertura: Date;
        fechaCierre: Date;
        estado: import(".prisma/client").$Enums.EstadoConvocatoria;
        id: string;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    findOne(id: string): Promise<{
        rankingConfig: {
            nombre: string;
            minMateriasCursando: number;
            minRegularizadas: number;
            criterioDesempate: string;
            id: string;
            createdAt: Date;
            convocatoriaId: string;
            version: number;
            tipo: string;
        };
    } & {
        nombre: string;
        fechaApertura: Date;
        fechaCierre: Date;
        estado: import(".prisma/client").$Enums.EstadoConvocatoria;
        id: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    create(dto: CreateConvocatoriaDto): import(".prisma/client").Prisma.Prisma__ConvocatoriaClient<{
        nombre: string;
        fechaApertura: Date;
        fechaCierre: Date;
        estado: import(".prisma/client").$Enums.EstadoConvocatoria;
        id: string;
        createdAt: Date;
        updatedAt: Date;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    update(id: string, dto: UpdateConvocatoriaDto): Promise<{
        nombre: string;
        fechaApertura: Date;
        fechaCierre: Date;
        estado: import(".prisma/client").$Enums.EstadoConvocatoria;
        id: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    cerrar(id: string): Promise<{
        nombre: string;
        fechaApertura: Date;
        fechaCierre: Date;
        estado: import(".prisma/client").$Enums.EstadoConvocatoria;
        id: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    upsertRankingConfig(id: string, dto: CreateRankingConfigDto): Promise<{
        nombre: string;
        minMateriasCursando: number;
        minRegularizadas: number;
        criterioDesempate: string;
        id: string;
        createdAt: Date;
        convocatoriaId: string;
        version: number;
        tipo: string;
    }>;
}
