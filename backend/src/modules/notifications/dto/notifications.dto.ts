import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import {
  NotificationStatus,
  NotificationType,
} from '../../../generated/prisma/enums.js';

export class NotificationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;
}

export class NotificationDto {
  id: string;
  @ApiProperty({ enum: NotificationType, enumName: 'NotificationType' })
  type: NotificationType;
  recipient: string;
  subject: string | null;
  @ApiProperty({ enum: NotificationStatus, enumName: 'NotificationStatus' })
  status: NotificationStatus;
  attempts: number;
  nextAttemptAt: string;
  lastError: string | null;
  sentAt: string | null;
  /** Pedido relacionado, si lo hay. */
  orderId: string | null;
  orderNumber: number | null;
  createdAt: string;
}

export class NotificationPageDto {
  items: NotificationDto[];
  total: number;
  page: number;
  pageSize: number;
}

/** Vista previa del correo tal como se envía (o se enviará). */
export class NotificationPreviewDto extends NotificationDto {
  previewSubject: string;
  previewText: string;
}
