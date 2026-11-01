import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { InventoryController } from './inventory.controller.js';
import { InventorySettingsService } from './inventory-settings.service.js';
import { LotsService } from './lots.service.js';
import { MovementsService } from './movements.service.js';
import { ReservationsService } from './reservations.service.js';
import { StockLedgerService } from './stock-ledger.service.js';
import { StockService } from './stock.service.js';

@Module({
  imports: [CatalogModule],
  controllers: [InventoryController],
  providers: [
    StockLedgerService,
    InventorySettingsService,
    LotsService,
    StockService,
    MovementsService,
    ReservationsService,
  ],
  exports: [
    StockLedgerService,
    LotsService,
    StockService,
    InventorySettingsService,
    ReservationsService,
  ],
})
export class InventoryModule {}
