import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module.js';
import { FilesModule } from '../files/files.module.js';
import { CategoriesController } from './categories/categories.controller.js';
import { CategoriesService } from './categories/categories.service.js';
import { ProductSearchService } from './products/product-search.service.js';
import { ProductsController } from './products/products.controller.js';
import { ProductsService } from './products/products.service.js';
import { SimpleCatalogController } from './simple/simple-catalog.controller.js';
import { SimpleCatalogService } from './simple/simple-catalog.service.js';
import { TaxRatesController } from './tax-rates/tax-rates.controller.js';

@Module({
  imports: [FilesModule, BillingModule],
  controllers: [
    SimpleCatalogController,
    CategoriesController,
    ProductsController,
    TaxRatesController,
  ],
  providers: [
    SimpleCatalogService,
    CategoriesService,
    ProductsService,
    ProductSearchService,
  ],
  exports: [ProductsService, ProductSearchService],
})
export class CatalogModule {}
