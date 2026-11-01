import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module.js';
import { DashboardService } from './dashboard.service.js';
import {
  DashboardController,
  ReportsController,
} from './reports.controller.js';
import { ReportsService } from './reports.service.js';

/** Dashboard e informes: consultas de solo lectura. */
@Module({
  imports: [InventoryModule],
  controllers: [DashboardController, ReportsController],
  providers: [ReportsService, DashboardService],
})
export class ReportsModule {}
