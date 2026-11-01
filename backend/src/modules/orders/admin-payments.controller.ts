import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthUser } from '../../common/auth/auth-user.js';
import {
  CurrentUser,
  RequirePermissions,
  StaffOnly,
} from '../../common/decorators/auth.decorators.js';
import { AuditRead } from '../audit/audit.decorators.js';
import { PERMISSIONS } from '../roles/permissions.catalog.js';
import { PaymentPageDto, RefundDto, RefundPageDto } from './dto/orders.dto.js';
import {
  CompleteRefundDto,
  CreateRefundDto,
  PaymentsQueryDto,
  RefundsQueryDto,
  RejectPaymentDto,
} from './dto/sales.dto.js';
import { PaymentsService } from './payments.service.js';

@ApiTags('Admin · Pagos')
@StaffOnly()
@Controller('admin')
export class AdminPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Por defecto, las transferencias pendientes de verificación. */
  @RequirePermissions(PERMISSIONS.ORDERS_READ)
  @Get('payments')
  list(@Query() query: PaymentsQueryDto): Promise<PaymentPageDto> {
    return this.payments.list(query);
  }

  /** Comprobante privado de la transferencia. */
  @RequirePermissions(PERMISSIONS.PAYMENTS_VERIFY)
  @AuditRead()
  @Get('payments/:id/proof')
  @ApiOkResponse({ description: 'Imagen o PDF del comprobante' })
  async proof(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { mimeType, sizeBytes, stream } = await this.payments.openProof(id);
    res.set({
      'Content-Type': mimeType,
      'Content-Length': String(sizeBytes),
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(stream);
  }

  @RequirePermissions(PERMISSIONS.PAYMENTS_VERIFY)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('payments/:id/approve')
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.payments.approve(user.id, id);
  }

  @RequirePermissions(PERMISSIONS.PAYMENTS_VERIFY)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('payments/:id/reject')
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectPaymentDto,
  ): Promise<void> {
    return this.payments.reject(user.id, id, dto.reason);
  }

  @RequirePermissions(PERMISSIONS.REFUNDS_MANAGE)
  @Post('payments/:id/refunds')
  createRefund(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRefundDto,
  ): Promise<RefundDto> {
    return this.payments.createRefund(user.id, id, dto);
  }

  @RequirePermissions(PERMISSIONS.ORDERS_READ)
  @Get('refunds')
  listRefunds(@Query() query: RefundsQueryDto): Promise<RefundPageDto> {
    return this.payments.listRefunds(query);
  }

  @RequirePermissions(PERMISSIONS.REFUNDS_MANAGE)
  @HttpCode(HttpStatus.OK)
  @Post('refunds/:id/complete')
  completeRefund(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteRefundDto,
  ): Promise<RefundDto> {
    return this.payments.completeRefund(user.id, id, dto.reference);
  }

  @RequirePermissions(PERMISSIONS.REFUNDS_MANAGE)
  @HttpCode(HttpStatus.OK)
  @Post('refunds/:id/cancel')
  cancelRefund(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RefundDto> {
    return this.payments.cancelRefund(user.id, id);
  }
}
