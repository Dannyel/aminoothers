import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module.js';
import { PromotionsModule } from '../promotions/promotions.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { CartController } from './cart.controller.js';
import { CartService } from './cart.service.js';

@Module({
  imports: [InventoryModule, SettingsModule, PromotionsModule],
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule {}
