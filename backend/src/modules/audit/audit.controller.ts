import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  RequirePermissions,
  StaffOnly,
} from '../../common/decorators/auth.decorators.js';
import { PERMISSIONS } from '../roles/permissions.catalog.js';
import { AuditService } from './audit.service.js';
import {
  AuditFiltersDto,
  AuditPageDto,
  AuditQueryDto,
} from './dto/audit.dto.js';

@ApiTags('Admin · Auditoría')
@StaffOnly()
@RequirePermissions(PERMISSIONS.AUDIT_READ)
@Controller('admin/audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query() query: AuditQueryDto): Promise<AuditPageDto> {
    return this.audit.list(query);
  }

  @Get('filters')
  filters(): Promise<AuditFiltersDto> {
    return this.audit.filters();
  }
}
