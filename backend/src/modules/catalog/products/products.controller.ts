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
  Put,
  Query,
  UploadedFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../../common/auth/auth-user.js';
import {
  CurrentUser,
  RequirePermissions,
  StaffOnly,
} from '../../../common/decorators/auth.decorators.js';
import type { UploadedContent } from '../../files/files.service.js';
import { PERMISSIONS } from '../../roles/permissions.catalog.js';
import { ImageUpload } from '../image-upload.js';
import {
  CreateProductDto,
  ListProductsQueryDto,
  ProductDetailDto,
  ProductOptionDto,
  ProductPageDto,
  ReorderImagesDto,
  SetOnlineSaleDto,
  UpdateProductDto,
  UpdateProductImageDto,
} from './dto/products.dto.js';
import { ProductsService } from './products.service.js';

@ApiTags('Admin · Productos')
@StaffOnly()
@Controller('admin/products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  /** Búsqueda por nombre, SKU, código de barras, marca o principio activo, y filtros. */
  @RequirePermissions(PERMISSIONS.PRODUCTS_READ)
  @Get()
  list(@Query() query: ListProductsQueryDto): Promise<ProductPageDto> {
    return this.products.list(query);
  }

  /** Productos activos (id, SKU, nombre) para selectores. */
  @RequirePermissions(PERMISSIONS.PRODUCTS_READ)
  @Get('options')
  options(): Promise<ProductOptionDto[]> {
    return this.products.options();
  }

  @RequirePermissions(PERMISSIONS.PRODUCTS_READ)
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<ProductDetailDto> {
    return this.products.get(id);
  }

  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  @Post()
  create(@Body() dto: CreateProductDto): Promise<ProductDetailDto> {
    return this.products.create(dto);
  }

  /** Cambiar a una condición que no sea venta libre, o desactivar, deshabilita la venta en línea. */
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductDetailDto> {
    return this.products.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.products.remove(id);
  }

  /** Verificación regulatoria: habilita o deshabilita la venta en línea. */
  @RequirePermissions(PERMISSIONS.PRODUCTS_APPROVE_ONLINE_SALE)
  @Put(':id/online-sale')
  setOnlineSale(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetOnlineSaleDto,
  ): Promise<ProductDetailDto> {
    return this.products.setOnlineSale(actor, id, dto.enabled);
  }

  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  @ImageUpload({ altText: { type: 'string', maxLength: 200 } })
  @Post(':id/images')
  addImage(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: UploadedContent,
    @Body('altText') altText?: string,
  ): Promise<ProductDetailDto> {
    return this.products.addImage(actor, id, file, altText);
  }

  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  @Put(':id/images/order')
  reorderImages(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderImagesDto,
  ): Promise<ProductDetailDto> {
    return this.products.reorderImages(id, dto.imageIds);
  }

  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  @Patch(':id/images/:imageId')
  updateImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Body() dto: UpdateProductImageDto,
  ): Promise<ProductDetailDto> {
    return this.products.updateImage(id, imageId, dto);
  }

  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  @Delete(':id/images/:imageId')
  removeImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ): Promise<ProductDetailDto> {
    return this.products.removeImage(id, imageId);
  }
}
