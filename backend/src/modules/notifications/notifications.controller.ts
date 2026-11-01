import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  RequirePermissions,
  StaffOnly,
} from '../../common/decorators/auth.decorators.js';
import { PERMISSIONS } from '../roles/permissions.catalog.js';
import {
  NotificationDto,
  NotificationPageDto,
  NotificationPreviewDto,
  NotificationsQueryDto,
} from './dto/notifications.dto.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('Admin · Notificaciones')
@StaffOnly()
@RequirePermissions(PERMISSIONS.NOTIFICATIONS_MANAGE)
@Controller('admin/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Query() query: NotificationsQueryDto): Promise<NotificationPageDto> {
    return this.notifications.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<NotificationPreviewDto> {
    return this.notifications.get(id);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/retry')
  retry(@Param('id', ParseUUIDPipe) id: string): Promise<NotificationDto> {
    return this.notifications.retry(id);
  }
}
