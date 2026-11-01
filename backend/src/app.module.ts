import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AUTH_RATE_LIMIT_KEY } from './common/decorators/auth.decorators.js';
import { EnvironmentVariables, validateEnv } from './config/env.validation.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { CartModule } from './modules/cart/cart.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { CustomersModule } from './modules/customers/customers.module.js';
import { FilesModule } from './modules/files/files.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { MailModule } from './modules/mail/mail.module.js';
import { MaintenanceModule } from './modules/maintenance/maintenance.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { PromotionsModule } from './modules/promotions/promotions.module.js';
import { PurchasingModule } from './modules/purchasing/purchasing.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { RolesModule } from './modules/roles/roles.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { StorefrontModule } from './modules/storefront/storefront.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => [
        {
          name: 'default',
          ttl: config.get('THROTTLE_TTL_MS', { infer: true }),
          limit: config.get('THROTTLE_LIMIT', { infer: true }),
        },
        {
          // Límite estricto solo para los endpoints marcados con @AuthRateLimit().
          name: 'auth',
          ttl: 60_000,
          limit: config.get('AUTH_THROTTLE_LIMIT', { infer: true }),
          skipIf: (context) =>
            !(
              Reflect.getMetadata(AUTH_RATE_LIMIT_KEY, context.getHandler()) ??
              Reflect.getMetadata(AUTH_RATE_LIMIT_KEY, context.getClass())
            ),
        },
      ],
    }),
    PrismaModule,
    MailModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    CustomersModule,
    FilesModule,
    CatalogModule,
    InventoryModule,
    PurchasingModule,
    SettingsModule,
    StorefrontModule,
    CartModule,
    OrdersModule,
    PromotionsModule,
    BillingModule,
    NotificationsModule,
    ReportsModule,
    AuditModule,
    MaintenanceModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
