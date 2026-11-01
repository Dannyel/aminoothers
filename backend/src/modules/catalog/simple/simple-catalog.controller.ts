import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import {
  RequirePermissions,
  StaffOnly,
} from '../../../common/decorators/auth.decorators.js';
import { PERMISSIONS } from '../../roles/permissions.catalog.js';
import {
  CatalogOptionDto,
  CreateSimpleCatalogItemDto,
  SIMPLE_CATALOG_KINDS,
  SimpleCatalogItemDto,
  type SimpleCatalogKind,
  SimpleCatalogListQueryDto,
  SimpleCatalogPageDto,
  UpdateSimpleCatalogItemDto,
} from './simple-catalog.dto.js';
import { SimpleCatalogService } from './simple-catalog.service.js';

const kindPipe = new ParseEnumPipe(
  Object.fromEntries(SIMPLE_CATALOG_KINDS.map((k) => [k, k])),
);

const KindParam = () =>
  ApiParam({
    name: 'kind',
    enum: SIMPLE_CATALOG_KINDS,
    description: 'Catálogo',
  });

@ApiTags('Admin · Catálogos')
@StaffOnly()
@Controller('admin/catalog/:kind')
export class SimpleCatalogController {
  constructor(private readonly catalogs: SimpleCatalogService) {}

  @RequirePermissions(PERMISSIONS.CATALOG_READ)
  @KindParam()
  @Get()
  list(
    @Param('kind', kindPipe) kind: SimpleCatalogKind,
    @Query() query: SimpleCatalogListQueryDto,
  ): Promise<SimpleCatalogPageDto> {
    return this.catalogs.list(kind, query);
  }

  /** Elementos activos para selectores. Basta con poder consultar productos. */
  @RequirePermissions(PERMISSIONS.PRODUCTS_READ)
  @KindParam()
  @Get('options')
  options(
    @Param('kind', kindPipe) kind: SimpleCatalogKind,
  ): Promise<CatalogOptionDto[]> {
    return this.catalogs.options(kind);
  }

  @RequirePermissions(PERMISSIONS.CATALOG_MANAGE)
  @KindParam()
  @Post()
  create(
    @Param('kind', kindPipe) kind: SimpleCatalogKind,
    @Body() dto: CreateSimpleCatalogItemDto,
  ): Promise<SimpleCatalogItemDto> {
    return this.catalogs.create(kind, dto);
  }

  @RequirePermissions(PERMISSIONS.CATALOG_MANAGE)
  @KindParam()
  @Patch(':id')
  update(
    @Param('kind', kindPipe) kind: SimpleCatalogKind,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSimpleCatalogItemDto,
  ): Promise<SimpleCatalogItemDto> {
    return this.catalogs.update(kind, id, dto);
  }

  /** Baja lógica; si algún producto lo usa, hay que desactivarlo. */
  @RequirePermissions(PERMISSIONS.CATALOG_MANAGE)
  @KindParam()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(
    @Param('kind', kindPipe) kind: SimpleCatalogKind,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.catalogs.remove(kind, id);
  }
}
