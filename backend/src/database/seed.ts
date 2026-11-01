/**
 * Datos base: catálogo de permisos, roles de sistema y el superadministrador
 * inicial. Es idempotente. Uso: `pnpm db:seed` (requiere `pnpm build`).
 *
 * Variables:
 *   INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD  (obligatorias si no existe
 *   ningún superadministrador), INITIAL_ADMIN_FIRST_NAME, INITIAL_ADMIN_LAST_NAME
 */
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import { PrismaClient } from '../generated/prisma/client.js';
import { UserType } from '../generated/prisma/enums.js';
import { syncAccessControl } from '../modules/roles/sync-access-control.js';

if (!process.env.DATABASE_URL) {
  process.loadEnvFile(process.env.ENV_FILE ?? '.env');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function ensureSuperAdmin(): Promise<void> {
  const existing = await prisma.user.count({
    where: {
      type: UserType.STAFF,
      roles: { some: { role: { code: 'SUPER_ADMIN' } } },
    },
  });
  if (existing > 0) {
    console.log('Ya existe un superadministrador; no se crea otro.');
    return;
  }

  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'No hay superadministrador: defina INITIAL_ADMIN_EMAIL e INITIAL_ADMIN_PASSWORD para crearlo.',
    );
  }
  if (password.length < 12) {
    throw new Error(
      'INITIAL_ADMIN_PASSWORD debe tener al menos 12 caracteres.',
    );
  }

  const role = await prisma.role.findUniqueOrThrow({
    where: { code: 'SUPER_ADMIN' },
  });
  await prisma.user.create({
    data: {
      email,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      type: UserType.STAFF,
      firstName:
        process.env.INITIAL_ADMIN_FIRST_NAME?.trim() || 'Administrador',
      lastName: process.env.INITIAL_ADMIN_LAST_NAME?.trim() || 'General',
      emailVerifiedAt: new Date(),
      roles: { create: { roleId: role.id } },
    },
  });
  console.log(
    `Superadministrador creado: ${email}. Cambie la contraseña al ingresar.`,
  );
}

try {
  await syncAccessControl(prisma);
  console.log('Permisos y roles de sistema sincronizados.');
  await ensureSuperAdmin();
} finally {
  await prisma.$disconnect();
}
