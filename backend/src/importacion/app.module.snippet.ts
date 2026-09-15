import { Module } from '@nestjs/common';
import { ImportacionModule } from './importacion.module';

@Module({
  imports: [
    // ... otros modulos
    ImportacionModule,
  ],
})
export class AppModule {}

