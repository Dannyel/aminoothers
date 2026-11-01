import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import {
  IsNit,
  IsNormalizedEmail,
  IsPhone,
  IsRequiredText,
} from '../../../common/validation/validators.js';
import {
  LotStatus,
  PurchaseOrderStatus,
} from '../../../generated/prisma/enums.js';
import { IsUnitCost, LotNumber } from '../../inventory/dto/inventory.dto.js';

const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value,
);

// ─── Proveedores ─────────────────────────────────────────────────────────────

export class SupplierInputDto {
  @IsRequiredText(200) name: string;
  @IsOptional() @IsNit() taxId?: string | null;
  @IsOptional() @trim @IsString() @MaxLength(150) contactName?: string | null;
  @IsOptional() @IsPhone() phone?: string | null;
  @IsOptional() @IsNormalizedEmail() email?: string | null;
  @IsOptional() @trim @IsString() @MaxLength(300) address?: string | null;
  @IsOptional() @trim @IsString() @MaxLength(1000) notes?: string | null;
}

export class UpdateSupplierDto extends SupplierInputDto {
  @IsOptional() @IsRequiredText(200) declare name: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ListSuppliersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['active', 'inactive', 'all'])
  @ApiProperty({ enum: ['active', 'inactive', 'all'], required: false })
  status: 'active' | 'inactive' | 'all' = 'active';
}

export class SupplierDto {
  id: string;
  name: string;
  taxId: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  purchaseOrderCount: number;
}

export class SupplierPageDto {
  items: SupplierDto[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Órdenes de compra ───────────────────────────────────────────────────────

export class PurchaseOrderItemInputDto {
  @IsUUID() productId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity: number;

  /** Costo unitario sin IVA. */
  @IsUnitCost() unitCost: string;
}

export class PurchaseOrderInputDto {
  @IsUUID() supplierId: string;

  /** AAAA-MM-DD. */
  @IsOptional() @IsDateString({ strict: true }) expectedDate?: string | null;

  @IsOptional() @trim @IsString() @MaxLength(1000) notes?: string | null;

  @IsArray()
  @ArrayMinSize(1, { message: 'Agregue al menos un producto' })
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemInputDto)
  items: PurchaseOrderItemInputDto[];
}

export class ListPurchaseOrdersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  @ApiProperty({
    enum: PurchaseOrderStatus,
    enumName: 'PurchaseOrderStatus',
    required: false,
  })
  status?: PurchaseOrderStatus;

  @IsOptional() @IsUUID() supplierId?: string;
}

export class ReceiptItemInputDto {
  @IsUUID() purchaseOrderItemId: string;

  @trim @LotNumber() lotNumber: string;

  /** AAAA-MM-DD. Obligatoria para medicamentos. */
  @IsOptional() @IsDateString({ strict: true }) expirationDate?: string;
  @IsOptional() @IsDateString({ strict: true }) manufacturingDate?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity: number;

  /** Si se omite, el costo de la orden. */
  @IsOptional() @IsUnitCost() unitCost?: string;

  /** Disponible (por defecto) o cuarentena hasta su liberación (D6). */
  @IsOptional()
  @IsIn([LotStatus.AVAILABLE, LotStatus.QUARANTINE])
  @ApiProperty({
    enum: [LotStatus.AVAILABLE, LotStatus.QUARANTINE],
    required: false,
  })
  initialStatus?: LotStatus;
}

export class ReceiptInputDto {
  @IsOptional() @trim @IsString() @MaxLength(50) supplierInvoiceNumber?: string;
  @IsOptional() @trim @IsString() @MaxLength(1000) notes?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Registre al menos una línea recibida' })
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ReceiptItemInputDto)
  items: ReceiptItemInputDto[];
}

export class RefDto {
  id: string;
  name: string;
}

export class PurchaseOrderItemDto {
  id: string;
  product: { id: string; sku: string; name: string };
  quantityOrdered: number;
  quantityReceived: number;
  quantityPending: number;
  unitCost: string;
  taxRate: string;
  lineSubtotal: string;
  lineTax: string;
  lineTotal: string;
}

export class ReceiptItemDto {
  id: string;
  purchaseOrderItemId: string;
  product: { id: string; sku: string; name: string };
  lot: { id: string; lotNumber: string; expirationDate: string | null };
  quantity: number;
  unitCost: string;
  @ApiProperty({ enum: LotStatus, enumName: 'LotStatus' })
  initialStatus: LotStatus;
}

export class ReceiptDto {
  id: string;
  number: number;
  supplierInvoiceNumber: string | null;
  notes: string | null;
  receivedBy: RefDto;
  receivedAt: string;
  items: ReceiptItemDto[];
}

export class PurchaseOrderSummaryDto {
  id: string;
  number: number;
  supplier: RefDto;
  @ApiProperty({ enum: PurchaseOrderStatus, enumName: 'PurchaseOrderStatus' })
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDate: string | null;
  subtotal: string;
  taxTotal: string;
  total: string;
  createdAt: string;
}

export class PurchaseOrderPageDto {
  items: PurchaseOrderSummaryDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class PurchaseOrderDetailDto extends PurchaseOrderSummaryDto {
  notes: string | null;
  createdBy: RefDto;
  approvedBy: RefDto | null;
  approvedAt: string | null;
  closedAt: string | null;
  items: PurchaseOrderItemDto[];
  receipts: ReceiptDto[];
}
