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
  CategoryDto,
  CreateCategoryDto,
  CreateSubcategoryDto,
  SubcategoryDto,
  UpdateCategoryDto,
  UpdateSubcategoryDto,
} from './categories.dto.js';
import { CategoriesService } from './categories.service.js';

@ApiTags('Admin · Categorías')
@StaffOnly()
@Controller('admin')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  /** Categorías con sus subcategorías. También la usa el formulario de producto. */
  @RequirePermissions(PERMISSIONS.PRODUCTS_READ)
  @Get('categories')
  list(): Promise<CategoryDto[]> {
    return this.categories.list();
  }

  @RequirePermissions(PERMISSIONS.CATALOG_READ)
  @Get('categories/:id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<CategoryDto> {
    return this.categories.get(id);
  }

  @RequirePermissions(PERMISSIONS.CATALOG_MANAGE)
  @Post('categories')
  create(@Body() dto: CreateCategoryDto): Promise<CategoryDto> {
    return this.categories.create(dto);
  }

  @RequirePermissions(PERMISSIONS.CATALOG_MANAGE)
  @Patch('categories/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryDto> {
    return this.categories.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.CATALOG_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('categories/:id')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.categories.remove(id);
  }

  @RequirePermissions(PERMISSIONS.CATALOG_MANAGE)
  @ImageUpload()
  @Put('categories/:id/image')
  setImage(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: UploadedContent,
  ): Promise<CategoryDto> {
    return this.categories.setImage(actor, id, file);
  }

  @RequirePermissions(PERMISSIONS.CATALOG_MANAGE)
  @Delete('categories/:id/image')
  removeImage(@Param('id', ParseUUIDPipe) id: string): Promise<CategoryDto> {
    return this.categories.removeImage(id);
  }

  @RequirePermissions(PERMISSIONS.CATALOG_MANAGE)
  @Post('categories/:id/subcategories')
  createSubcategory(
    @Param('id', ParseUUIDPipe) categoryId: string,
    @Body() dto: CreateSubcategoryDto,
  ): Promise<SubcategoryDto> {
    return this.categories.createSubcategory(categoryId, dto);
  }

  @RequirePermissions(PERMISSIONS.CATALOG_MANAGE)
  @Patch('subcategories/:id')
  updateSubcategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubcategoryDto,
  ): Promise<SubcategoryDto> {
    return this.categories.updateSubcategory(id, dto);
  }

  @RequirePermissions(PERMISSIONS.CATALOG_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('subcategories/:id')
  removeSubcategory(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.categories.removeSubcategory(id);
  }
}
