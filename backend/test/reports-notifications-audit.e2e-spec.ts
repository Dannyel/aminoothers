import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { todayInBusinessZone } from '../src/common/utils/dates.js';
import {
  MAX_ATTEMPTS,
  NotificationDispatcherService,
} from '../src/modules/notifications/notification-dispatcher.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import {
  createTestApp,
  type RecordingMailService,
} from './support/create-app.js';
import {
  bearer,
  createAddress,
  createCustomer,
  createSellableProduct,
  createShippingMethod,
  createStaff,
  login,
  PASSWORD,
  resetDatabase,
  type Tokens,
} from './support/fixtures.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const STAFF_INBOX = 'alertas@farmacia.gt';

describe('Notificaciones, auditoría, reportes y dashboard (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let mail: RecordingMailService;
  let dispatcher: NotificationDispatcherService;
  let admin: Tokens;
  let adminId: string;
  let customer: Tokens;
  let customerEmail: string;
  let addressId: string;
  let shippingId: string;
  let bankAccountId: string;
  let productId: string;
  const http = () => request(app.getHttpServer());

  const placeOrder = async (
    paymentMethod: 'BANK_TRANSFER' | 'CASH_ON_DELIVERY',
    quantity = 2,
  ) => {
    await http()
      .post('/api/v1/store/cart/items')
      .set(bearer(customer))
      .send({ productId, quantity })
      .expect(200);
    const cart = await http()
      .get(`/api/v1/store/cart?shippingMethodId=${shippingId}`)
      .set(bearer(customer))
      .expect(200);
    const res = await http()
      .post('/api/v1/store/orders')
      .set(bearer(customer))
      .set('Idempotency-Key', randomUUID())
      .send({
        addressId,
        shippingMethodId: shippingId,
        paymentMethod,
        expectedTotal: cart.body.summary.total,
      })
      .expect(201);
    return res.body as { id: string; number: number; total: string };
  };

  const submitTransfer = async (orderId: string, reference: string) => {
    await http()
      .post(`/api/v1/store/orders/${orderId}/transfer`)
      .set(bearer(customer))
      .field('bankAccountId', bankAccountId)
      .field('bankReference', reference)
      .field('transferDate', todayInBusinessZone())
      .attach('file', PNG, 'comprobante.png')
      .expect(200);
    return prisma.payment.findFirstOrThrow({
      where: { orderId, status: 'IN_REVIEW' },
    });
  };

  const queued = (type?: string) =>
    prisma.notificationLog.findMany({
      where: type ? { type: type as never } : {},
      orderBy: { createdAt: 'asc' },
    });

  beforeAll(async () => {
    ({ app, prisma, mail } = await createTestApp());
    dispatcher = app.get(NotificationDispatcherService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    mail.clear();
    const adminUser = await createStaff(prisma, ['ADMIN']);
    adminId = adminUser.id;
    admin = await login(app, 'admin', adminUser.email);
    const user = await createCustomer(prisma);
    customerEmail = user.email;
    customer = await login(app, 'store', user.email);
    addressId = (await createAddress(prisma, user.id)).id;
    shippingId = (await createShippingMethod(prisma, { cost: '20.00' })).id;
    productId = (
      await createSellableProduct(prisma, {
        name: 'Protector solar',
        price: '50.00',
        lots: [{ qty: 40 }],
      })
    ).id;
    bankAccountId = (
      await prisma.bankAccount.create({
        data: {
          bankName: 'Banco',
          accountNumber: '100-200',
          accountType: 'Monetaria',
          accountHolder: 'Farmacia',
        },
      })
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('bandeja de salida', () => {
    it('encola los avisos del pedido en su transacción y los envía', async () => {
      await prisma.storeSettings.update({
        where: { id: 1 },
        data: { staffAlertEmail: STAFF_INBOX },
      });
      const order = await placeOrder('BANK_TRANSFER');
      const payment = await submitTransfer(order.id, 'REF-001');
      await http()
        .post(`/api/v1/admin/payments/${payment.id}/reject`)
        .set(bearer(admin))
        .send({ reason: 'El monto no coincide' })
        .expect(204);
      // Una operación rechazada no deja avisos: el cliente no puede cancelar
      // dos veces.
      await http()
        .post(`/api/v1/store/orders/${order.id}/cancel`)
        .set(bearer(customer))
        .send({})
        .expect(200);
      await http()
        .post(`/api/v1/store/orders/${order.id}/cancel`)
        .set(bearer(customer))
        .send({})
        .expect(409);

      const rows = await queued();
      expect(rows.map((r) => [r.type, r.recipient, r.status])).toEqual([
        ['ORDER_PLACED', customerEmail, 'PENDING'],
        ['STAFF_TRANSFER_TO_VERIFY', STAFF_INBOX, 'PENDING'],
        ['ORDER_STATUS_CHANGED', customerEmail, 'PENDING'],
        ['ORDER_STATUS_CHANGED', customerEmail, 'PENDING'],
      ]);
      expect(mail.messages).toEqual([]);

      expect(await dispatcher.dispatchDue()).toEqual({
        sent: 4,
        retried: 0,
        failed: 0,
      });
      const label = `PED-${String(order.number).padStart(6, '0')}`;
      expect(mail.messages.map((m) => [m.to, m.subject])).toEqual([
        [customerEmail, `Recibimos su pedido ${label}`],
        [STAFF_INBOX, `Comprobante por verificar: ${label}`],
        [customerEmail, `No pudimos verificar el pago del pedido ${label}`],
        [customerEmail, `Su pedido ${label} fue cancelado`],
      ]);
      expect(mail.messages[1].text).toContain('referencia REF-001');
      expect(mail.messages[2].text).toContain('Motivo: El monto no coincide');
      expect(mail.messages[3].text).toContain(
        'Motivo: Cancelado por el cliente',
      );
      expect(
        (await queued()).every((r) => r.status === 'SENT' && r.sentAt),
      ).toBe(true);
      // Nada queda pendiente: un segundo ciclo no reenvía.
      expect((await dispatcher.dispatchDue()).sent).toBe(0);
    });

    it('sin buzón del personal no se avisa del comprobante', async () => {
      const order = await placeOrder('BANK_TRANSFER');
      await submitTransfer(order.id, 'REF-002');
      expect(await queued('STAFF_TRANSFER_TO_VERIFY')).toEqual([]);
    });

    it('reintenta con espera creciente y queda fallido tras el máximo', async () => {
      await placeOrder('CASH_ON_DELIVERY');
      const send = vi
        .spyOn(mail, 'send')
        .mockRejectedValue(new Error('SMTP caído'));
      try {
        let now = new Date();
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          const result = await dispatcher.dispatchDue(now);
          const [row] = await queued();
          expect(row.attempts).toBe(attempt);
          expect(row.lastError).toBe('SMTP caído');
          if (attempt < MAX_ATTEMPTS) {
            expect(result).toEqual({ sent: 0, retried: 1, failed: 0 });
            expect(row.status).toBe('PENDING');
            // Antes del plazo de espera no se vuelve a intentar.
            expect(
              (await dispatcher.dispatchDue(new Date(now.getTime() + 1000)))
                .retried,
            ).toBe(0);
            now = row.nextAttemptAt;
          } else {
            expect(result).toEqual({ sent: 0, retried: 0, failed: 1 });
            expect(row.status).toBe('FAILED');
          }
        }
      } finally {
        send.mockRestore();
      }

      const [failed] = await queued();
      const finance = await login(
        app,
        'admin',
        (await createStaff(prisma, ['FINANCE'])).email,
      );
      await http()
        .get('/api/v1/admin/notifications')
        .set(bearer(finance))
        .expect(403);
      const list = await http()
        .get('/api/v1/admin/notifications?status=FAILED')
        .set(bearer(admin))
        .expect(200);
      expect(list.body).toMatchObject({
        total: 1,
        items: [
          {
            id: failed.id,
            type: 'ORDER_PLACED',
            attempts: MAX_ATTEMPTS,
            orderNumber: 1,
          },
        ],
      });
      const preview = await http()
        .get(`/api/v1/admin/notifications/${failed.id}`)
        .set(bearer(admin))
        .expect(200);
      expect(preview.body.previewSubject).toBe(
        'Recibimos su pedido PED-000001',
      );
      expect(preview.body.previewText).toContain('efectivo contra entrega');

      await http()
        .post(`/api/v1/admin/notifications/${failed.id}/retry`)
        .set(bearer(admin))
        .expect(200);
      await http()
        .post(`/api/v1/admin/notifications/${failed.id}/retry`)
        .set(bearer(admin))
        .expect(409);
      expect((await dispatcher.dispatchDue()).sent).toBe(1);
      expect(mail.lastTo(customerEmail)?.subject).toBe(
        'Recibimos su pedido PED-000001',
      );
    });

    it('encola el resumen diario de inventario una sola vez por día', async () => {
      await createSellableProduct(prisma, {
        name: 'Por vencer',
        lots: [{ qty: 5, expiresInDays: 20 }],
      });
      // 06:00 en Guatemala: antes de la hora del resumen.
      expect(
        await dispatcher.enqueueInventoryDigest(
          new Date('2030-01-01T12:00:00Z'),
        ),
      ).toBe(false);
      // Sin buzón del personal no se encola.
      expect(
        await dispatcher.enqueueInventoryDigest(
          new Date('2030-01-01T14:00:00Z'),
        ),
      ).toBe(false);
      await prisma.storeSettings.update({
        where: { id: 1 },
        data: { staffAlertEmail: STAFF_INBOX },
      });
      expect(
        await dispatcher.enqueueInventoryDigest(
          new Date('2030-01-01T15:00:00Z'),
        ),
      ).toBe(true);
      expect(
        await dispatcher.enqueueInventoryDigest(
          new Date('2030-01-01T20:00:00Z'),
        ),
      ).toBe(false);
      const [digest] = await queued('STAFF_INVENTORY_DIGEST');
      expect(digest).toMatchObject({
        recipient: STAFF_INBOX,
        dedupeKey: 'INVENTORY_DIGEST:2030-01-01',
        payload: expect.objectContaining({ nearExpiryLots: 1 }),
      });
      await dispatcher.dispatchDue();
      expect(mail.lastTo(STAFF_INBOX)?.text).toContain(
        '1 lote(s) próximos a vencer',
      );
    });
  });

  describe('auditoría', () => {
    it('registra las operaciones del personal con IP y valores anteriores', async () => {
      await http()
        .patch(`/api/v1/admin/products/${productId}`)
        .set(bearer(admin))
        .set('User-Agent', 'pruebas-e2e')
        .send({ price: '55.00' })
        .expect(200);
      await http()
        .patch('/api/v1/admin/settings/store')
        .set(bearer(admin))
        .send({ staffAlertEmail: STAFF_INBOX })
        .expect(200);

      const [product] = await prisma.auditLog.findMany({
        where: { module: 'products' },
      });
      expect(product).toMatchObject({
        userId: adminId,
        action: 'update',
        route: 'PATCH /admin/products/:id',
        entityId: productId,
        userAgent: 'pruebas-e2e',
        statusCode: 200,
        changes: {
          params: { id: productId },
          request: { price: '55.00' },
          before: { price: '50' },
          after: { price: '55' },
        },
      });
      expect(product.ip).toBeTruthy();
      const [settings] = await prisma.auditLog.findMany({
        where: { module: 'settings' },
      });
      expect(settings.changes).toMatchObject({
        before: { staffAlertEmail: null },
        after: { staffAlertEmail: STAFF_INBOX },
      });

      // Solo inserción: el registro no se modifica ni se borra.
      await expect(
        prisma.auditLog.update({
          where: { id: product.id },
          data: { action: 'otra' },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.auditLog.delete({ where: { id: product.id } }),
      ).rejects.toThrow();
    });

    it('registra inicios de sesión y accesos a comprobantes; no audita al cliente', async () => {
      const staffUser = await createStaff(prisma, ['FINANCE']);
      await http()
        .post('/api/v1/auth/admin/login')
        .send({ email: staffUser.email, password: 'incorrecta' })
        .expect(401);
      const finance = await login(app, 'admin', staffUser.email, PASSWORD);

      const order = await placeOrder('BANK_TRANSFER');
      const payment = await submitTransfer(order.id, 'REF-003');
      await http()
        .get(`/api/v1/admin/payments/${payment.id}/proof`)
        .set(bearer(finance))
        .expect(200);

      const rows = await prisma.auditLog.findMany({
        where: { userId: staffUser.id },
        orderBy: { id: 'asc' },
      });
      expect(rows.map((r) => [r.module, r.action])).toEqual([
        ['auth', 'LOGIN_FAILED'],
        ['auth', 'LOGIN'],
        ['payments', 'proof'],
      ]);
      expect(rows[0].changes).toMatchObject({
        email: staffUser.email,
        step: 'password',
      });
      // El carrito, el pedido y la transferencia del cliente no se auditan.
      expect(
        await prisma.auditLog.count({
          where: { user: { type: 'CUSTOMER' } },
        }),
      ).toBe(0);
    });

    it('no guarda secretos y solo lo consulta quien tiene audit.read', async () => {
      await http()
        .post('/api/v1/admin/users')
        .set(bearer(admin))
        .send({
          email: 'nuevo@farmacia.gt',
          firstName: 'Nuevo',
          lastName: 'Usuario',
          roleIds: [],
        })
        .expect(201);
      const finance = await login(
        app,
        'admin',
        (await createStaff(prisma, ['FINANCE'])).email,
      );
      await http().get('/api/v1/admin/audit').set(bearer(finance)).expect(403);

      const page = await http()
        .get('/api/v1/admin/audit?module=users')
        .set(bearer(admin))
        .expect(200);
      expect(page.body.total).toBe(1);
      expect(page.body.items[0]).toMatchObject({
        action: 'create',
        user: { id: adminId },
        changes: { request: { email: 'nuevo@farmacia.gt' } },
      });
      expect(page.body.items[0].entityId).toBeTruthy();
      const filters = await http()
        .get('/api/v1/admin/audit/filters')
        .set(bearer(admin))
        .expect(200);
      expect(filters.body.modules).toEqual(
        expect.arrayContaining(['auth', 'users']),
      );
      const today = todayInBusinessZone();
      const ranged = await http()
        .get(`/api/v1/admin/audit?from=${today}&to=${today}&userId=${adminId}`)
        .set(bearer(admin))
        .expect(200);
      expect(ranged.body.total).toBeGreaterThanOrEqual(2);

      // Contraseñas y tokens nunca llegan a la auditoría.
      const all = await prisma.auditLog.findMany();
      expect(JSON.stringify(all.map((r) => r.changes))).not.toContain(PASSWORD);
    });
  });

  describe('reportes y dashboard', () => {
    it('cuenta como venta solo los pedidos confirmados', async () => {
      // Venta por transferencia aprobada: 2 × Q50 + Q20 de envío.
      const paid = await placeOrder('BANK_TRANSFER', 2);
      const payment = await submitTransfer(paid.id, 'REF-010');
      await http()
        .post(`/api/v1/admin/payments/${payment.id}/approve`)
        .set(bearer(admin))
        .expect(204);
      // Venta contra entrega confirmada: 1 × Q50 + Q20.
      const cod = await placeOrder('CASH_ON_DELIVERY', 1);
      await http()
        .post(`/api/v1/admin/orders/${cod.id}/confirm`)
        .set(bearer(admin))
        .send({})
        .expect(200);
      // Pendiente y cancelado: no cuentan.
      await placeOrder('BANK_TRANSFER', 3);
      const cancelled = await placeOrder('CASH_ON_DELIVERY', 1);
      await http()
        .post(`/api/v1/admin/orders/${cancelled.id}/cancel`)
        .set(bearer(admin))
        .send({ reason: 'Duplicado' })
        .expect(200);

      const today = todayInBusinessZone();
      const sales = await http()
        .get(`/api/v1/admin/reports/sales?from=${today}&to=${today}`)
        .set(bearer(admin))
        .expect(200);
      expect(sales.body.totals).toMatchObject({
        orders: 2,
        units: 3,
        subtotal: '150.00',
        shipping: '40.00',
        total: '190.00',
        averageTicket: '95.00',
      });
      expect(sales.body.days).toEqual([
        expect.objectContaining({ date: today, orders: 2, total: '190.00' }),
      ]);
      expect(sales.body.byPaymentMethod).toEqual([
        { method: 'BANK_TRANSFER', orders: 1, total: '120.00' },
        { method: 'CASH_ON_DELIVERY', orders: 1, total: '70.00' },
      ]);

      const top = await http()
        .get(`/api/v1/admin/reports/top-products?from=${today}&to=${today}`)
        .set(bearer(admin))
        .expect(200);
      expect(top.body.rows).toEqual([
        expect.objectContaining({
          productId,
          name: 'Protector solar',
          units: 3,
          revenue: '150.00',
        }),
      ]);
      const categories = await http()
        .get(`/api/v1/admin/reports/categories?from=${today}&to=${today}`)
        .set(bearer(admin))
        .expect(200);
      expect(categories.body).toMatchObject({
        total: '150.00',
        rows: [{ name: 'Cuidado personal', units: 3, share: '100.0' }],
      });

      await prisma.lot.updateMany({
        where: { productId },
        data: { avgUnitCost: '20.5000' },
      });
      const valuation = await http()
        .get('/api/v1/admin/reports/inventory-valuation')
        .set(bearer(admin))
        .expect(200);
      expect(valuation.body).toMatchObject({
        totalUnits: 40,
        totalValue: '820.00',
        unsellableValue: '0.00',
      });

      await http()
        .get(`/api/v1/admin/reports/sales?from=${today}&to=2020-01-01`)
        .set(bearer(admin))
        .expect(400);
      const warehouse = await login(
        app,
        'admin',
        (await createStaff(prisma, ['WAREHOUSE'])).email,
      );
      await http()
        .get(`/api/v1/admin/reports/sales?from=${today}&to=${today}`)
        .set(bearer(warehouse))
        .expect(403);

      // El dashboard muestra solo las secciones permitidas.
      const full = await http()
        .get('/api/v1/admin/dashboard')
        .set(bearer(admin))
        .expect(200);
      expect(full.body).toMatchObject({
        today,
        orders: {
          placedToday: 4,
          paymentInReview: 0,
          toPrepare: 2,
        },
        sales: {
          today: { orders: 2, total: '190.00' },
          monthToDate: { orders: 2, total: '190.00' },
          topProducts: [expect.objectContaining({ units: 3 })],
        },
        finance: { pendingRefunds: 0, felPending: 1 },
        notifications: { failed: 0 },
      });
      expect(full.body.sales.daily).toHaveLength(30);
      expect(full.body.sales.daily.at(-1)).toEqual({
        date: today,
        orders: 2,
        total: '190.00',
      });
      const limited = await http()
        .get('/api/v1/admin/dashboard')
        .set(bearer(warehouse))
        .expect(200);
      expect(limited.body).toMatchObject({
        sales: null,
        finance: null,
        notifications: null,
        orders: expect.objectContaining({ toPrepare: 2 }),
        inventory: expect.objectContaining({ lowStockProducts: 0 }),
      });
    });
  });
});
