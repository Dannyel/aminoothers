import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { AddressesService } from './addresses.service.js';
import { AdminCustomersController } from './admin-customers.controller.js';
import { CustomersService } from './customers.service.js';
import { StoreCustomersController } from './store-customers.controller.js';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [StoreCustomersController, AdminCustomersController],
  providers: [CustomersService, AddressesService],
  exports: [AddressesService],
})
export class CustomersModule {}
