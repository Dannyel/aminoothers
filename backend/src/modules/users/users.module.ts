import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AccountStatusService } from './account-status.service.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersService, AccountStatusService],
  exports: [AccountStatusService],
})
export class UsersModule {}
