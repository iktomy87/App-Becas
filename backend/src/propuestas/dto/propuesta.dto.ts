import { IsString, IsEnum, IsInt, IsOptional, IsEmail, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoPropuesta } from '@prisma/client';

export class CreatePropuestaDto {
  @ApiProperty() @IsString() idExterno: string;
  @ApiProperty() @IsString() titulo: string;
  @ApiProperty({ enum: TipoPropuesta }) @IsEnum(TipoPropuesta) tipo: TipoPropuesta;
  @ApiProperty() @IsString() responsableNombre: string;
  @ApiProperty() @IsEmail() responsableEmail: string;
  @ApiProperty() @IsInt() @Min(1) vacantesTotal: number;
  @ApiProperty() @IsString() convocatoriaId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dependencia?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() especialidades?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() periodo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() horario?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() objetivo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tareas?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() observaciones?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reqRegularizadas?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reqAprobadas?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reqOtros?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() modulos?: number;
}

export class UpdateVacantesDto {
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) vacantesTotal: number;
}
