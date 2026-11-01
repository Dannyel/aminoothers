import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/auth.decorators.js';
import {
  StoreCategoryDto,
  StoreProductDetailDto,
  StoreProductPageDto,
  StoreProductsQueryDto,
} from './dto/storefront.dto.js';
import { StorefrontService } from './storefront.service.js';

@ApiTags('Tienda · Catálogo')
@Public()
@Controller('store')
export class StorefrontController {
  constructor(private readonly storefront: StorefrontService) {}

  /** Categorías activas con sus subcategorías. */
  @Get('categories')
  categories(): Promise<StoreCategoryDto[]> {
    return this.storefront.categories();
  }

  /** Catálogo con búsqueda, filtros por categoría, subcategoría y marca, y orden. */
  @Get('products')
  products(
    @Query() query: StoreProductsQueryDto,
  ): Promise<StoreProductPageDto> {
    return this.storefront.products(query);
  }

  @Get('products/:slug')
  product(@Param('slug') slug: string): Promise<StoreProductDetailDto> {
    return this.storefront.product(slug.slice(0, 250));
  }
}
