import type { NestExpressApplication } from '@nestjs/platform-express';
import argon2 from 'argon2';
import { rm } from 'node:fs/promises';
import request from 'supertest';
import { SecretBox } from '../../src/common/utils/secret-box.js';
import {
  currentStep,
  generateTotpSecret,
  totpCode,
} from '../../src/common/utils/totp.js';
import { UserType } from '../../src/generated/prisma/enums.js';
import { syncAccessControl } from '../../src/modules/roles/sync-access-control.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

export const PASSWORD = 'clave-de-prueba-1';

/** Deja la base de prueba vacía, con el catálogo de permisos y roles de sistema. */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE audit_logs, notification_logs, invoice_items, invoices, promotion_products, promotions,
             refunds, return_items, returns, shipment_events, shipments, couriers, bank_accounts,
             payment_status_history, payments, stock_reservations, order_status_history,
             order_items, orders, cart_items, carts, shipping_methods,
             purchase_receipt_items, purchase_receipts, purchase_order_items, purchase_orders,
             suppliers, inventory_movements, lots,
             product_tags, product_images, product_active_ingredients, products,
             subcategories, categories, brands, manufacturers, presentations,
             concentrations, active_ingredients, tags, files,
             mfa_challenges, user_recovery_codes, user_tokens, sessions, customer_addresses, customers,
             user_roles, role_permissions, roles, permissions, users
    RESTART IDENTITY CASCADE`);
  // TRUNCATE files … CASCADE también vacía store_settings (FK del logotipo):
  // se recrea la fila única con los valores iniciales.
  await prisma.storeSettings.create({ data: { id: 1 } });
  // Tasas sembradas por la migración del catálogo, en su estado inicial.
  for (const sql of [
    `DELETE FROM tax_rates WHERE code NOT IN ('IVA', 'EXENTO')`,
    `UPDATE tax_rates SET is_default = false, rate = 0, is_active = true WHERE code = 'EXENTO'`,
    `UPDATE tax_rates SET rate = 0.12, is_default = true, is_active = true, name = 'IVA 12 %' WHERE code = 'IVA'`,
  ]) {
    await prisma.$executeRawUnsafe(sql);
  }
  await syncAccessControl(prisma);
  await rm(process.env.UPLOAD_DIR ?? './storage/test-uploads', {
    recursive: true,
    force: true,
  });
}

let counter = 0;
const uniqueEmail = (prefix: string) =>
  `${prefix}.${Date.now()}.${++counter}@prueba.gt`;

let cachedHash: string | undefined;
const passwordHash = async () =>
  (cachedHash ??= await argon2.hash(PASSWORD, { type: argon2.argon2id }));

const box = () => new SecretBox(process.env.TOTP_ENCRYPTION_KEY!);

/** Los usuarios de las fábricas ya tienen el doble factor configurado. */
const enrolledTotp = () => ({
  totpSecret: box().encrypt(generateTotpSecret()),
  totpEnabledAt: new Date(),
});

/** Código TOTP vigente del usuario, como lo mostraría su app autenticadora. */
export async function totpFor(
  prisma: PrismaService,
  email: string,
): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  // Las pruebas inician sesión varias veces en el mismo paso de 30 s; se
  // libera la protección contra reutilización solo para eso.
  await prisma.user.update({
    where: { id: user.id },
    data: { totpLastStep: null },
  });
  return totpCode(box().decrypt(user.totpSecret!), currentStep());
}

/** Crea un usuario del personal con los roles indicados (por código). */
export async function createStaff(
  prisma: PrismaService,
  roleCodes: string[] = [],
  overrides: { email?: string } = {},
) {
  const roles = await prisma.role.findMany({
    where: { code: { in: roleCodes } },
  });
  return prisma.user.create({
    data: {
      email: overrides.email ?? uniqueEmail('staff'),
      passwordHash: await passwordHash(),
      type: UserType.STAFF,
      firstName: 'Personal',
      lastName: 'Prueba',
      emailVerifiedAt: new Date(),
      ...enrolledTotp(),
      roles: { create: roles.map((r) => ({ roleId: r.id })) },
    },
  });
}

/** Crea un rol personalizado con los permisos indicados y un usuario que lo tiene. */
export async function createStaffWithPermissions(
  prisma: PrismaService,
  permissions: string[],
) {
  const code = `ROL_${++counter}`;
  const found = await prisma.permission.findMany({
    where: { code: { in: permissions } },
  });
  await prisma.role.create({
    data: {
      code,
      name: code,
      permissions: { create: found.map((p) => ({ permissionId: p.id })) },
    },
  });
  return createStaff(prisma, [code]);
}

export async function createCustomer(
  prisma: PrismaService,
  overrides: { email?: string; emailVerified?: boolean } = {},
) {
  return prisma.user.create({
    data: {
      email: overrides.email ?? uniqueEmail('cliente'),
      passwordHash: await passwordHash(),
      type: UserType.CUSTOMER,
      firstName: 'Cliente',
      lastName: 'Prueba',
      emailVerifiedAt: overrides.emailVerified === false ? null : new Date(),
      ...enrolledTotp(),
      customer: { create: {} },
    },
  });
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Inicio de sesión completo: contraseña y doble factor. Si el usuario aún no
 * configuró la app, hace la configuración inicial como lo haría el usuario.
 */
export async function login(
  app: NestExpressApplication,
  portal: 'store' | 'admin',
  email: string,
  password = PASSWORD,
): Promise<Tokens & { recoveryCodes?: string[] }> {
  const http = () => request(app.getHttpServer());
  const challenge = await http()
    .post(`/api/v1/auth/${portal}/login`)
    .send({ email, password })
    .expect(200);
  const { mfaToken, enrollmentRequired } = challenge.body;

  if (enrollmentRequired) {
    const enrollment = await http()
      .post('/api/v1/auth/mfa/enroll')
      .send({ mfaToken })
      .expect(200);
    const confirmed = await http()
      .post('/api/v1/auth/mfa/enroll/confirm')
      .send({ mfaToken, code: totpCode(enrollment.body.secret, currentStep()) })
      .expect(200);
    return confirmed.body;
  }

  const code = await totpFor(app.get(PrismaService), email);
  const verified = await http()
    .post('/api/v1/auth/mfa/verify')
    .send({ mfaToken, code })
    .expect(200);
  return verified.body as Tokens;
}

export const bearer = (tokens: Tokens) => ({
  Authorization: `Bearer ${tokens.accessToken}`,
});

/** Dirección de entrega del cliente (predeterminada). */
export function createAddress(prisma: PrismaService, customerId: string) {
  return prisma.customerAddress.create({
    data: {
      customerId,
      label: 'Casa',
      recipientName: 'Cliente Prueba',
      phone: '5555-1234',
      addressLine1: '5a avenida 10-20',
      zone: '10',
      municipality: 'Guatemala',
      department: 'Guatemala',
      isDefault: true,
    },
  });
}

let skuCounter = 0;

/**
 * Producto de venta libre habilitado para la venta en línea, con un lote por
 * cada elemento de `lots` (sin movimientos: solo para probar reservas y tienda).
 */
export async function createSellableProduct(
  prisma: PrismaService,
  options: {
    name?: string;
    price?: string;
    categoryId?: string;
    lots?: Array<{
      qty: number;
      expiresInDays?: number | null;
      status?: 'AVAILABLE' | 'QUARANTINE';
    }>;
    overrides?: Record<string, unknown>;
  } = {},
) {
  const tax = await prisma.taxRate.findFirstOrThrow({ where: { code: 'IVA' } });
  const categoryId =
    options.categoryId ??
    (
      await prisma.category.upsert({
        where: { id: '00000000-0000-7000-8000-000000000001' },
        create: {
          id: '00000000-0000-7000-8000-000000000001',
          name: 'Cuidado personal',
          slug: 'cuidado-personal',
        },
        update: {},
      })
    ).id;
  // La habilitación regulatoria registra quién la aprobó.
  const approver =
    (await prisma.user.findFirst({ where: { type: UserType.STAFF } })) ??
    (await createStaff(prisma, ['PHARMACIST']));
  const n = ++skuCounter;
  const product = await prisma.product.create({
    data: {
      sku: `SKU-${n}`,
      name: options.name ?? `Producto ${n}`,
      slug: `producto-${n}`,
      price: options.price ?? '30.00',
      categoryId,
      taxRateId: tax.id,
      onlineSaleEnabled: true,
      onlineSaleApprovedById: approver.id,
      onlineSaleApprovedAt: new Date(),
      ...options.overrides,
    },
  });
  const warehouse = await prisma.warehouse.findFirstOrThrow();
  let lotIndex = 0;
  for (const lot of options.lots ?? [{ qty: 20, expiresInDays: 365 }]) {
    const days = lot.expiresInDays === undefined ? 365 : lot.expiresInDays;
    await prisma.lot.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        lotNumber: `L-${n}-${++lotIndex}`,
        expirationDate:
          days === null ? null : new Date(Date.now() + days * 86_400_000),
        status: lot.status ?? 'AVAILABLE',
        qtyOnHand: lot.qty,
        firstReceivedAt: new Date(Date.now() + lotIndex * 1000),
      },
    });
  }
  return product;
}

/** Método de envío activo. */
export function createShippingMethod(
  prisma: PrismaService,
  data: { name?: string; cost?: string; allowsCashOnDelivery?: boolean } = {},
) {
  return prisma.shippingMethod.create({
    data: {
      name: data.name ?? 'Capital',
      cost: data.cost ?? '25.00',
      allowsCashOnDelivery: data.allowsCashOnDelivery ?? true,
    },
  });
}
