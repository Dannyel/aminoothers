import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module.js';
import { NotificationDispatcherService } from './notification-dispatcher.service.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

/**
 * Bandeja de salida de correos. Los módulos encolan con las funciones de
 * `outbox.ts` dentro de sus transacciones; este módulo envía y administra.
 */
@Module({
  imports: [InventoryModule],
  controllers: [NotificationsController],
  providers: [NotificationDispatcherService, NotificationsService],
  exports: [NotificationDispatcherService],
})
export class NotificationsModule {}
