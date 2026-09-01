import { IsString, IsDateString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoConvocatoria } from '@prisma/client';

export class CreateConvocatoriaDto {
  @ApiProperty({ example: 'BIS 2026 - 1er semestre' })
  @IsString()
  nombre: string;

  @ApiProperty({ example: '2026-04-01' })
  @IsDateString()
  fechaApertura: string;

  @ApiProperty({ example: '2026-06-30' })
  @IsDateString()
  fechaCierre: string;
}

export class UpdateConvocatoriaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fechaApertura?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fechaCierre?: string;
}

export class UpdateEstadoConvocatoriaDto {
  @ApiProperty({ enum: EstadoConvocatoria })
  @IsEnum(EstadoConvocatoria)
  estado: EstadoConvocatoria;
}

export class CreateRankingConfigDto {
  @ApiPropertyOptional({ default: 3 })
  @IsOptional()
  minMateriasCursando?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  minRegularizadas?: number;

  @ApiPropertyOptional({ default: 'PROMEDIO', description: 'PROMEDIO | APROBADAS | ANTIGUEDAD' })
  @IsOptional()
  @IsString()
  criterioDesempate?: string;
}
