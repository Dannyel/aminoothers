import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';

export class AuditQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Matches(/^[a-z0-9-]{1,40}$/)
  module?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  /** Id del registro afectado (pedido, producto, etc.). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityId?: string;

  /** AAAA-MM-DD, en la zona del negocio. */
  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;
}

export class AuditUserDto {
  id: string;
  name: string;
  email: string;
}

export class AuditLogDto {
  id: string;
  createdAt: string;
  user: AuditUserDto | null;
  action: string;
  module: string;
  route: string | null;
  entityId: string | null;
  /** Datos enviados (sin secretos) y valores antes/después cuando aplica. */
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  changes: Record<string, unknown> | null;
  statusCode: number | null;
  ip: string | null;
  userAgent: string | null;
}

export class AuditPageDto {
  items: AuditLogDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class AuditFiltersDto {
  modules: string[];
  users: AuditUserDto[];
}
