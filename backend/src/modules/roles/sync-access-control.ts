import type { PrismaClient } from '../../generated/prisma/client.js';
import { PERMISSION_CATALOG, SYSTEM_ROLES } from './permissions.catalog.js';

/**
 * Sincroniza el catálogo de permisos y los roles de sistema con la base de
 * datos. Es idempotente: se ejecuta en cada seed y antes de las pruebas e2e.
 */
export async function syncAccessControl(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.permission.findMany({ select: { code: true } });
    const existingCodes = new Set(existing.map((p) => p.code));
    const catalogCodes = new Set(PERMISSION_CATALOG.map((p) => p.code));

    const added = new Set<string>();
    for (const permission of PERMISSION_CATALOG) {
      await tx.permission.upsert({
        where: { code: permission.code },
        create: permission,
        update: {
          module: permission.module,
          description: permission.description,
        },
      });
      if (!existingCodes.has(permission.code)) added.add(permission.code);
    }
    await tx.permission.deleteMany({
      where: { code: { notIn: [...catalogCodes] } },
    });

    for (const role of SYSTEM_ROLES) {
      const current = await tx.role.findUnique({ where: { code: role.code } });
      const isNew = current === null;
      const saved = await tx.role.upsert({
        where: { code: role.code },
        create: {
          code: role.code,
          name: role.name,
          description: role.description,
          isSystem: true,
        },
        update: { isSystem: true },
      });
      // Rol nuevo: todos sus permisos iniciales. Rol existente: solo los
      // permisos que acaban de agregarse al catálogo.
      const toGrant = role.permissions.filter(
        (code) => isNew || added.has(code),
      );
      if (toGrant.length === 0) continue;
      const permissions = await tx.permission.findMany({
        where: { code: { in: toGrant } },
        select: { id: true },
      });
      await tx.rolePermission.createMany({
        data: permissions.map((p) => ({
          roleId: saved.id,
          permissionId: p.id,
        })),
        skipDuplicates: true,
      });
    }
  });
}
