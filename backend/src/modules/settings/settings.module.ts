import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module.js';
import { BankAccountsService } from './bank-accounts.service.js';
import { CouriersService } from './couriers.service.js';
import {
  AdminSettingsController,
  StoreInfoController,
} from './settings.controller.js';
import { ShippingMethodsService } from './shipping-methods.service.js';
import { StoreSettingsService } from './store-settings.service.js';

@Module({
  imports: [FilesModule],
  controllers: [AdminSettingsController, StoreInfoController],
  providers: [
    StoreSettingsService,
    ShippingMethodsService,
    BankAccountsService,
    CouriersService,
  ],
  exports: [StoreSettingsService, ShippingMethodsService, CouriersService],
})
export class SettingsModule {}
