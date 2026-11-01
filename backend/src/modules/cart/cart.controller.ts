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
  CustomerOnly,
} from '../../common/decorators/auth.decorators.js';
import { CartService } from './cart.service.js';
import {
  AddCartItemDto,
  CartDto,
  CartQueryDto,
  SetCartQuantityDto,
} from './dto/cart.dto.js';

@ApiTags('Tienda · Carrito')
@CustomerOnly()
@Controller('store/cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  /** Carrito con precios y disponibilidad actuales. */
  @Get()
  view(
    @CurrentUser() user: AuthUser,
    @Query() query: CartQueryDto,
  ): Promise<CartDto> {
    return this.cart.view(user.id, query.shippingMethodId);
  }

  /** Unidades en el carrito. */
  @Get('count')
  async count(@CurrentUser() user: AuthUser): Promise<{ count: number }> {
    return { count: await this.cart.count(user.id) };
  }

  @HttpCode(HttpStatus.OK)
  @Post('items')
  add(
    @CurrentUser() user: AuthUser,
    @Body() dto: AddCartItemDto,
  ): Promise<CartDto> {
    return this.cart.add(user.id, dto);
  }

  @Patch('items/:productId')
  setQuantity(
    @CurrentUser() user: AuthUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: SetCartQuantityDto,
  ): Promise<CartDto> {
    return this.cart.setQuantity(user.id, productId, dto.quantity);
  }

  @Delete('items/:productId')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<CartDto> {
    return this.cart.remove(user.id, productId);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete()
  clear(@CurrentUser() user: AuthUser): Promise<void> {
    return this.cart.clear(user.id);
  }
}
