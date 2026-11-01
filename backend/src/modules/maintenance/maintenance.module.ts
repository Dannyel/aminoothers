import { Module } from '@nestjs/common';
import { RetentionService } from './retention.service.js';

/** Tareas de mantenimiento de la base de datos (retención de datos, D20). */
@Module({
  providers: [RetentionService],
})
export class MaintenanceModule {}
