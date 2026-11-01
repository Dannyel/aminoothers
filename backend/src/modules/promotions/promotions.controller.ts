import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
  PromotionDto,
  PromotionInputDto,
  PromotionPageDto,
  PromotionsQueryDto,
  UpdatePromotionDto,
} from './dto/promotions.dto.js';
import { PromotionsService } from './promotions.service.js';

@ApiTags('Admin · Promociones')
@StaffOnly()
@Controller('admin/promotions')
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @RequirePermissions(PERMISSIONS.PROMOTIONS_READ)
  @Get()
  list(@Query() query: PromotionsQueryDto): Promise<PromotionPageDto> {
    return this.promotions.list(query);
  }

  @RequirePermissions(PERMISSIONS.PROMOTIONS_READ)
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<PromotionDto> {
    return this.promotions.get(id);
  }

  @RequirePermissions(PERMISSIONS.PROMOTIONS_MANAGE)
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: PromotionInputDto,
  ): Promise<PromotionDto> {
    return this.promotions.create(user.id, dto);
  }

  @RequirePermissions(PERMISSIONS.PROMOTIONS_MANAGE)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePromotionDto,
  ): Promise<PromotionDto> {
    return this.promotions.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.PROMOTIONS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.promotions.remove(id);
  }
}
