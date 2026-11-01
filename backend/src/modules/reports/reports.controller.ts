import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import {
  CurrentUser,
  RequirePermissions,
  StaffOnly,
} from '../../common/decorators/auth.decorators.js';
import { PERMISSIONS } from '../roles/permissions.catalog.js';
import { DashboardService } from './dashboard.service.js';
import {
  CategorySalesReportDto,
  DashboardDto,
  InventoryValuationDto,
  ReportRangeQueryDto,
  SalesReportDto,
  TopProductsQueryDto,
  TopProductsReportDto,
} from './dto/reports.dto.js';
import { ReportsService } from './reports.service.js';

@ApiTags('Admin · Dashboard')
@StaffOnly()
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /** Indicadores según los permisos del usuario. */
  @Get()
  get(@CurrentUser() user: AuthUser): Promise<DashboardDto> {
    return this.dashboard.get(user);
  }
}

@ApiTags('Admin · Reportes')
@StaffOnly()
@RequirePermissions(PERMISSIONS.REPORTS_READ)
@Controller('admin/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('sales')
  sales(@Query() query: ReportRangeQueryDto): Promise<SalesReportDto> {
    return this.reports.sales(query.from, query.to);
  }

  @Get('top-products')
  topProducts(
    @Query() query: TopProductsQueryDto,
  ): Promise<TopProductsReportDto> {
    return this.reports.topProducts(query.from, query.to, query.limit);
  }

  @Get('categories')
  categories(
    @Query() query: ReportRangeQueryDto,
  ): Promise<CategorySalesReportDto> {
    return this.reports.categories(query.from, query.to);
  }

  @Get('inventory-valuation')
  inventoryValuation(): Promise<InventoryValuationDto> {
    return this.reports.inventoryValuation();
  }
}
