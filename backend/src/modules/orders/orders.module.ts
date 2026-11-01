import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module.js';
import { FilesModule } from '../files/files.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { PromotionsModule } from '../promotions/promotions.module.js';
import { AdminOrdersController } from './admin-orders.controller.js';
import { AdminPaymentsController } from './admin-payments.controller.js';
import { AdminReturnsController } from './admin-returns.controller.js';
import { CheckoutService } from './checkout.service.js';
import { OrderWorkflowService } from './order-workflow.service.js';
import { OrdersService } from './orders.service.js';
import { PaymentsService } from './payments.service.js';
import { ReservationExpiryService } from './reservation-expiry.service.js';
import { ReturnsService } from './returns.service.js';
import { StoreOrdersController } from './store-orders.controller.js';

@Module({
  imports: [InventoryModule, FilesModule, PromotionsModule, BillingModule],
  controllers: [
    StoreOrdersController,
    AdminOrdersController,
    AdminPaymentsController,
    AdminReturnsController,
  ],
  providers: [
    CheckoutService,
    OrdersService,
    ReservationExpiryService,
    OrderWorkflowService,
    PaymentsService,
    ReturnsService,
  ],
})
export class OrdersModule {}
