import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import {
  CurrentUser,
  RequirePermissions,
  StaffOnly,
} from '../../common/decorators/auth.decorators.js';
import { PERMISSIONS } from '../roles/permissions.catalog.js';
import {
  AdjustmentDto,
  CreateLotDto,
  InventoryAlertsDto,
  InventorySettingsDto,
  InventorySettingsResponseDto,
  ListLotsQueryDto,
  ListMovementsQueryDto,
  LotDto,
  LotPageDto,
  LotStatusDto,
  MovementPageDto,
  OutflowDto,
  ProductStockPageDto,
  StockQueryDto,
} from './dto/inventory.dto.js';
import { InventorySettingsService } from './inventory-settings.service.js';
import { LotsService } from './lots.service.js';
import { MovementsService } from './movements.service.js';
import { StockService } from './stock.service.js';

@ApiTags('Admin · Inventario')
@StaffOnly()
@Controller('admin/inventory')
export class InventoryController {
  constructor(
    private readonly stock: StockService,
    private readonly lots: LotsService,
    private readonly movements: MovementsService,
    private readonly settings: InventorySettingsService,
  ) {}

  /** Existencias por producto: física, reservada, disponible, vencida, en cuarentena. */
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  @Get('stock')
  summary(@Query() query: StockQueryDto): Promise<ProductStockPageDto> {
    return this.stock.summary(query);
  }

  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  @Get('alerts')
  alerts(): Promise<InventoryAlertsDto> {
    return this.stock.alerts();
  }

  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  @Get('lots')
  listLots(@Query() query: ListLotsQueryDto): Promise<LotPageDto> {
    return this.lots.list(query);
  }

  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  @Get('lots/:id')
  getLot(@Param('id', ParseUUIDPipe) id: string): Promise<LotDto> {
    return this.lots.get(id);
  }

  /** Existencia inicial o ingreso fuera de una compra (crea el lote). */
  @RequirePermissions(PERMISSIONS.INVENTORY_ADJUST)
  @Post('lots')
  createLot(
    @CurrentUser() actor: AuthUser,
    @Body() dto: CreateLotDto,
  ): Promise<LotDto> {
    return this.lots.createWithStock(actor, dto);
  }

  /** Ajuste de entrada o salida con motivo. Nunca deja existencias negativas. */
  @RequirePermissions(PERMISSIONS.INVENTORY_ADJUST)
  @Post('lots/:id/adjustments')
  adjust(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustmentDto,
  ): Promise<LotDto> {
    return this.lots.adjust(actor, id, dto);
  }

  /** Baja por vencimiento, daño, retiro del mercado o devolución al proveedor. */
  @RequirePermissions(PERMISSIONS.INVENTORY_ADJUST)
  @Post('lots/:id/outflows')
  outflow(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OutflowDto,
  ): Promise<LotDto> {
    return this.lots.outflow(actor, id, dto);
  }

  /** Cuarentena, retiro del mercado, bloqueo o liberación del lote. */
  @RequirePermissions(PERMISSIONS.INVENTORY_QUARANTINE)
  @Patch('lots/:id/status')
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LotStatusDto,
  ): Promise<LotDto> {
    return this.lots.setStatus(id, dto);
  }

  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  @Get('movements')
  listMovements(
    @Query() query: ListMovementsQueryDto,
  ): Promise<MovementPageDto> {
    return this.movements.list(query);
  }

  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  @Get('settings')
  getSettings(): Promise<InventorySettingsResponseDto> {
    return this.settings.get();
  }

  @RequirePermissions(PERMISSIONS.INVENTORY_SETTINGS)
  @Put('settings')
  updateSettings(
    @CurrentUser() actor: AuthUser,
    @Body() dto: InventorySettingsDto,
  ): Promise<InventorySettingsResponseDto> {
    return this.settings.update(actor, dto);
  }
}
