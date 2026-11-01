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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import {
  CurrentUser,
  CustomerOnly,
  Public,
} from '../../common/decorators/auth.decorators.js';
import { AddressesService } from './addresses.service.js';
import { CustomersService } from './customers.service.js';
import {
  AddressDto,
  AddressInputDto,
  CustomerProfileDto,
  UpdateAddressDto,
  UpdateProfileDto,
} from './dto/customers.dto.js';
import { GUATEMALA_DEPARTMENTS } from './guatemala.js';

@ApiTags('Tienda · Cuenta del cliente')
@Controller('store')
export class StoreCustomersController {
  constructor(
    private readonly customers: CustomersService,
    private readonly addresses: AddressesService,
  ) {}

  /** Departamentos de Guatemala aceptados en las direcciones. */
  @Public()
  @Get('departments')
  departments(): readonly string[] {
    return GUATEMALA_DEPARTMENTS;
  }

  @CustomerOnly()
  @Get('profile')
  getProfile(@CurrentUser() user: AuthUser): Promise<CustomerProfileDto> {
    return this.customers.getProfile(user.id);
  }

  @CustomerOnly()
  @Patch('profile')
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<CustomerProfileDto> {
    return this.customers.updateProfile(user.id, dto);
  }

  @CustomerOnly()
  @Get('addresses')
  listAddresses(@CurrentUser() user: AuthUser): Promise<AddressDto[]> {
    return this.addresses.list(user.id);
  }

  @CustomerOnly()
  @Post('addresses')
  createAddress(
    @CurrentUser() user: AuthUser,
    @Body() dto: AddressInputDto,
  ): Promise<AddressDto> {
    return this.addresses.create(user.id, dto);
  }

  @CustomerOnly()
  @Patch('addresses/:id')
  updateAddress(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAddressDto,
  ): Promise<AddressDto> {
    return this.addresses.update(user.id, id, dto);
  }

  @CustomerOnly()
  @HttpCode(HttpStatus.OK)
  @Post('addresses/:id/default')
  setDefaultAddress(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AddressDto> {
    return this.addresses.setDefault(user.id, id);
  }

  @CustomerOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('addresses/:id')
  removeAddress(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.addresses.remove(user.id, id);
  }
}
