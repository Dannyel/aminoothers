import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import type { AuthUser } from '../../common/auth/auth-user.js';
import {
  CurrentUser,
  CustomerOnly,
} from '../../common/decorators/auth.decorators.js';
import { DocumentUpload } from '../files/document-upload.js';
import type { UploadedContent } from '../files/files.service.js';
import { CheckoutService } from './checkout.service.js';
import {
  OrderDetailDto,
  OrderSummaryPageDto,
  PlaceOrderDto,
  StoreOrdersQueryDto,
} from './dto/orders.dto.js';
import { CustomerCancelOrderDto, SubmitTransferDto } from './dto/sales.dto.js';
import { OrderWorkflowService } from './order-workflow.service.js';
import { OrdersService } from './orders.service.js';
import { PaymentsService } from './payments.service.js';

@ApiTags('Tienda · Pedidos')
@CustomerOnly()
@Controller('store/orders')
export class StoreOrdersController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly orders: OrdersService,
    private readonly workflow: OrderWorkflowService,
    private readonly payments: PaymentsService,
  ) {}

  /**
   * Confirma el pedido con el carrito actual. Reenviar la misma
   * `Idempotency-Key` devuelve el pedido ya creado en lugar de duplicarlo.
   * Responde 409 si el total cambió (`code: TOTAL_CHANGED`) o si ya no hay
   * existencia suficiente (`code: INSUFFICIENT_STOCK`).
   */
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID generado por el cliente para este intento de compra',
  })
  @Post()
  place(
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') key: string | undefined,
    @Body() dto: PlaceOrderDto,
  ): Promise<OrderDetailDto> {
    if (!key || !isUUID(key)) {
      throw new BadRequestException('Falta la cabecera Idempotency-Key (UUID)');
    }
    return this.checkout.place(user.id, key.toLowerCase(), dto);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: StoreOrdersQueryDto,
  ): Promise<OrderSummaryPageDto> {
    return this.orders.listForCustomer(user.id, query);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrderDetailDto> {
    return this.orders.getForCustomer(user.id, id);
  }

  /** El cliente puede cancelar antes de que el pedido se confirme (D8). */
  @HttpCode(HttpStatus.OK)
  @Post(':id/cancel')
  async cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CustomerCancelOrderDto,
  ): Promise<OrderDetailDto> {
    await this.workflow.cancelByCustomer(user.id, id, dto.reason);
    return this.orders.getForCustomer(user.id, id);
  }

  /**
   * Registra la transferencia con su comprobante (JPEG, PNG, WebP o PDF). El
   * pago queda en verificación hasta que la farmacia lo revise.
   */
  @DocumentUpload({
    bankAccountId: { type: 'string', format: 'uuid' },
    bankReference: { type: 'string' },
    transferDate: { type: 'string', format: 'date' },
  })
  @HttpCode(HttpStatus.OK)
  @Post(':id/transfer')
  async submitTransfer(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitTransferDto,
    @UploadedFile() file?: UploadedContent,
  ): Promise<OrderDetailDto> {
    await this.payments.submitTransfer(user.id, id, file, dto);
    return this.orders.getForCustomer(user.id, id);
  }
}
