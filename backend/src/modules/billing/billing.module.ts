import { Module } from '@nestjs/common';
import {
  AdminBillingController,
  StoreReceiptController,
} from './billing.controller.js';
import { InvoicesService } from './invoices.service.js';
import { TaxRatesService } from './tax-rates.service.js';

@Module({
  controllers: [AdminBillingController, StoreReceiptController],
  providers: [TaxRatesService, InvoicesService],
  exports: [TaxRatesService, InvoicesService],
})
export class BillingModule {}
