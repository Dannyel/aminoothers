import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module.js';
import { PurchaseOrdersService } from './purchase-orders.service.js';
import { PurchasingController } from './purchasing.controller.js';
import { SuppliersService } from './suppliers.service.js';

@Module({
  imports: [InventoryModule],
  controllers: [PurchasingController],
  providers: [SuppliersService, PurchaseOrdersService],
})
export class PurchasingModule {}
