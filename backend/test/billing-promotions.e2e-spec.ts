import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { todayInBusinessZone } from '../src/common/utils/dates.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './support/create-app.js';
import {
  bearer,
  createAddress,
  createCustomer,
  createSellableProduct,
  createShippingMethod,
  createStaff,
  login,
  resetDatabase,
  type Tokens,
} from './support/fixtures.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const HOUR = 3_600_000;

describe('Promociones, impuestos y facturación (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Tokens;
  let customer: Tokens;
  let addressId: string;
  let shippingId: string;
  let courierId: string;
  let bankAccountId: string;
  let productId: string;
  const http = () => request(app.getHttpServer());

  const staff = async (role: string) =>
    login(app, 'admin', (await createStaff(prisma, [role])).email);

  const createPromotion = (body: Record<string, unknown>, tokens = admin) =>
    http()
      .post('/api/v1/admin/promotions')
      .set(bearer(tokens))
      .send({
        name: 'Promoción',
        type: 'PERCENTAGE',
        value: '10',
        startsAt: new Date(Date.now() - HOUR).toISOString(),
        endsAt: new Date(Date.now() + 24 * HOUR).toISOString(),
        productIds: [productId],
        ...body,
      });

  const cart = async (tokens: Tokens = customer) =>
    (
      await http()
        .get(`/api/v1/store/cart?shippingMethodId=${shippingId}`)
        .set(bearer(tokens))
        .expect(200)
    ).body;

  const placeOrder = async (
    paymentMethod: 'BANK_TRANSFER' | 'CASH_ON_DELIVERY',
    quantity = 2,
  ) => {
    await http()
      .post('/api/v1/store/cart/items')
      .set(bearer(customer))
      .send({ productId, quantity })
      .expect(200);
    // El total se calcula antes de armar la petición: supertest no admite otra
    // petición en curso mientras construye esta.
    const expectedTotal = (await cart()).summary.total;
    const res = await http()
      .post('/api/v1/store/orders')
      .set(bearer(customer))
      .set('Idempotency-Key', randomUUID())
      .send({
        addressId,
        shippingMethodId: shippingId,
        paymentMethod,
        expectedTotal,
      })
      .expect(201);
    return res.body as {
      id: string;
      total: string;
      items: Array<{ unitDiscount: string }>;
    };
  };

  /** Pedido por transferencia con el pago ya aprobado (emite el comprobante). */
  const paidOrder = async (quantity = 2) => {
    const order = await placeOrder('BANK_TRANSFER', quantity);
    await http()
      .post(`/api/v1/store/orders/${order.id}/transfer`)
      .set(bearer(customer))
      .field('bankAccountId', bankAccountId)
      .field('bankReference', `REF-${randomUUID().slice(0, 8)}`)
      .field('transferDate', todayInBusinessZone())
      .attach('file', PNG, 'comprobante.png')
      .expect(200);
    const payment = await prisma.payment.findFirstOrThrow({
      where: { orderId: order.id, status: 'IN_REVIEW' },
    });
    await http()
      .post(`/api/v1/admin/payments/${payment.id}/approve`)
      .set(bearer(admin))
      .expect(204);
    return { ...order, paymentId: payment.id };
  };

  const invoiceOf = (orderId: string) =>
    prisma.invoice.findUnique({ where: { orderId } });

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    admin = await staff('ADMIN');
    const user = await createCustomer(prisma);
    customer = await login(app, 'store', user.email);
    addressId = (await createAddress(prisma, user.id)).id;
    shippingId = (await createShippingMethod(prisma, { cost: '25.00' })).id;
    productId = (
      await createSellableProduct(prisma, {
        name: 'Crema humectante',
        price: '40.00',
        lots: [{ qty: 50 }],
      })
    ).id;
    courierId = (await prisma.courier.create({ data: { name: 'Mensajería' } }))
      .id;
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

  describe('promociones', () => {
    it('valida la vigencia, el valor y los permisos', async () => {
      await createPromotion({
        endsAt: new Date(Date.now() - 2 * HOUR).toISOString(),
      }).expect(400);
      await createPromotion({ value: '120' }).expect(400);
      // Un monto fijo no puede regalar el producto.
      await createPromotion({ type: 'FIXED_AMOUNT', value: '40.00' }).expect(
        400,
      );
      await createPromotion({ productIds: [randomUUID()] }).expect(404);

      const finance = await staff('FINANCE');
      await createPromotion({}, finance).expect(403);
      const sales = await staff('SALES');
      const created = await createPromotion(
        { name: 'Semana de la piel' },
        sales,
      ).expect(201);
      expect(created.body).toMatchObject({
        state: 'ACTIVE',
        value: '10.00',
        products: [expect.objectContaining({ id: productId, price: '40.00' })],
      });
      await createPromotion({
        name: 'Futura',
        startsAt: new Date(Date.now() + 48 * HOUR).toISOString(),
        endsAt: new Date(Date.now() + 72 * HOUR).toISOString(),
      }).expect(201);

      const active = await http()
        .get('/api/v1/admin/promotions?state=ACTIVE')
        .set(bearer(finance))
        .expect(200);
      expect(active.body.items.map((p: { name: string }) => p.name)).toEqual([
        'Semana de la piel',
      ]);
      const scheduled = await http()
        .get('/api/v1/admin/promotions?state=SCHEDULED')
        .set(bearer(finance))
        .expect(200);
      expect(scheduled.body.items[0]).toMatchObject({
        name: 'Futura',
        state: 'SCHEDULED',
      });

      await http()
        .patch(`/api/v1/admin/promotions/${created.body.id}`)
        .set(bearer(sales))
        .send({ isActive: false })
        .expect(200);
      await http()
        .delete(`/api/v1/admin/promotions/${created.body.id}`)
        .set(bearer(sales))
        .expect(204);
      const all = await http()
        .get('/api/v1/admin/promotions')
        .set(bearer(admin))
        .expect(200);
      expect(all.body.total).toBe(1);
    });

    it('aplica solo la de mayor descuento en la tienda, el carrito y el pedido', async () => {
      await createPromotion({ name: '10 %', value: '10' }).expect(201);
      const fixed = await createPromotion({
        name: 'Q6 menos',
        type: 'FIXED_AMOUNT',
        value: '6.00',
      }).expect(201);
      // Inactiva y vencida no cuentan aunque descuenten más.
      await createPromotion({
        name: 'Inactiva',
        value: '50',
        isActive: false,
      }).expect(201);
      await prisma.promotion.create({
        data: {
          name: 'Vencida',
          type: 'PERCENTAGE',
          value: '60',
          startsAt: new Date(Date.now() - 48 * HOUR),
          endsAt: new Date(Date.now() - 24 * HOUR),
          createdById: (
            await prisma.user.findFirstOrThrow({ where: { type: 'STAFF' } })
          ).id,
          products: { create: { productId } },
        },
      });

      const store = await http().get('/api/v1/store/products').expect(200);
      expect(store.body.items[0]).toMatchObject({
        price: '40.00',
        promotion: { name: 'Q6 menos', price: '34.00', discount: '6.00' },
      });

      await http()
        .post('/api/v1/store/cart/items')
        .set(bearer(customer))
        .send({ productId, quantity: 3 })
        .expect(200);
      const view = await cart();
      expect(view.lines[0]).toMatchObject({
        unitPrice: '40.00',
        unitDiscount: '6.00',
        promotionName: 'Q6 menos',
        lineTotal: '102.00',
      });
      // 120 − 18 + 25 de envío; IVA de 102 (10.93) + envío (2.68).
      expect(view.summary).toMatchObject({
        subtotal: '120.00',
        discountTotal: '18.00',
        taxTotal: '13.61',
        total: '127.00',
      });

      const order = await http()
        .post('/api/v1/store/orders')
        .set(bearer(customer))
        .set('Idempotency-Key', randomUUID())
        .send({
          addressId,
          shippingMethodId: shippingId,
          paymentMethod: 'BANK_TRANSFER',
          expectedTotal: view.summary.total,
        })
        .expect(201);
      expect(order.body).toMatchObject({
        subtotal: '120.00',
        discountTotal: '18.00',
        total: '127.00',
      });
      const item = await prisma.orderItem.findFirstOrThrow();
      expect(item.promotionId).toBe(fixed.body.id);
      expect(item.unitDiscount.toFixed(2)).toBe('6.00');
    });

    it('si la promoción termina antes de confirmar, el total cambia y se pide confirmar de nuevo', async () => {
      const promo = await createPromotion({ value: '25' }).expect(201);
      await http()
        .post('/api/v1/store/cart/items')
        .set(bearer(customer))
        .send({ productId, quantity: 1 })
        .expect(200);
      const seen = (await cart()).summary.total;
      expect(seen).toBe('55.00');
      await prisma.promotion.update({
        where: { id: promo.body.id },
        data: {
          endsAt: new Date(Date.now() - 1000),
          startsAt: new Date(Date.now() - 2000),
        },
      });
      const res = await http()
        .post('/api/v1/store/orders')
        .set(bearer(customer))
        .set('Idempotency-Key', randomUUID())
        .send({
          addressId,
          shippingMethodId: shippingId,
          paymentMethod: 'BANK_TRANSFER',
          expectedTotal: seen,
        })
        .expect(409);
      expect(res.body).toMatchObject({ code: 'TOTAL_CHANGED', total: '65.00' });
    });
  });

  describe('impuestos', () => {
    it('administra tasas: una sola predeterminada, sin desactivar las que se usan', async () => {
      const finance = await staff('FINANCE');
      const list = await http()
        .get('/api/v1/admin/billing/tax-rates')
        .set(bearer(finance))
        .expect(200);
      const iva = list.body.find((r: { code: string }) => r.code === 'IVA');
      expect(iva).toMatchObject({
        rate: '0.1200',
        isDefault: true,
        productCount: 1,
      });

      const reduced = await http()
        .post('/api/v1/admin/billing/tax-rates')
        .set(bearer(finance))
        .send({ code: 'IVA_REDUCIDO', name: 'Tasa reducida', ratePercent: '5' })
        .expect(201);
      expect(reduced.body).toMatchObject({ rate: '0.0500', isDefault: false });
      await http()
        .post('/api/v1/admin/billing/tax-rates')
        .set(bearer(finance))
        .send({ code: 'IVA_REDUCIDO', name: 'Otra', ratePercent: '5' })
        .expect(409);

      await http()
        .patch(`/api/v1/admin/billing/tax-rates/${iva.id}`)
        .set(bearer(finance))
        .send({ isActive: false })
        .expect(409);
      await http()
        .patch(`/api/v1/admin/billing/tax-rates/${iva.id}`)
        .set(bearer(finance))
        .send({ isDefault: false })
        .expect(409);
      await http()
        .patch(`/api/v1/admin/billing/tax-rates/${reduced.body.id}`)
        .set(bearer(finance))
        .send({ isDefault: true })
        .expect(200);
      const after = await http()
        .get('/api/v1/admin/billing/tax-rates')
        .set(bearer(finance))
        .expect(200);
      expect(
        after.body
          .filter((r: { isDefault: boolean }) => r.isDefault)
          .map((r: { code: string }) => r.code),
      ).toEqual(['IVA_REDUCIDO']);
      // IVA ya no es la predeterminada, pero un producto la usa.
      await http()
        .patch(`/api/v1/admin/billing/tax-rates/${iva.id}`)
        .set(bearer(finance))
        .send({ isActive: false })
        .expect(409);

      const sales = await staff('SALES');
      await http()
        .get('/api/v1/admin/billing/tax-rates')
        .set(bearer(sales))
        .expect(403);
    });

    it('un cambio de tasa aplica a las ventas siguientes, no a los pedidos existentes', async () => {
      const before = await placeOrder('CASH_ON_DELIVERY', 1);
      const iva = await prisma.taxRate.findFirstOrThrow({
        where: { code: 'IVA' },
      });
      await http()
        .patch(`/api/v1/admin/billing/tax-rates/${iva.id}`)
        .set(bearer(admin))
        .send({ ratePercent: '10' })
        .expect(200);
      const old = await prisma.orderItem.findFirstOrThrow({
        where: { orderId: before.id },
      });
      expect(old.taxRate.toFixed(4)).toBe('0.1200');
      expect(old.lineTax.toFixed(2)).toBe('4.29');

      await http()
        .post('/api/v1/store/cart/items')
        .set(bearer(customer))
        .send({ productId, quantity: 1 })
        .expect(200);
      // 40 − 40/1.10 = 3.64; envío 25 − 25/1.10 = 2.27.
      expect((await cart()).summary.taxTotal).toBe('5.91');
    });
  });

  describe('comprobantes y FEL', () => {
    it('emite el comprobante interno al aprobar la transferencia y registra la FEL', async () => {
      const order = await placeOrder('BANK_TRANSFER', 2);
      await http()
        .get(`/api/v1/store/orders/${order.id}/receipt`)
        .set(bearer(customer))
        .expect(404);
      const paid = await paidOrder(1);
      const first = await invoiceOf(paid.id);
      expect(first).not.toBeNull();

      const receipt = await http()
        .get(`/api/v1/store/orders/${paid.id}/receipt`)
        .set(bearer(customer))
        .expect(200);
      expect(receipt.body).toMatchObject({
        kind: 'INTERNAL_RECEIPT',
        status: 'ISSUED',
        customerTaxId: 'CF',
        subtotal: '65.00',
        total: '65.00',
        taxTotal: '6.97',
        legend: expect.stringContaining('no constituye factura'),
        fel: { status: 'PENDING', series: null },
      });
      expect(receipt.body.items).toEqual([
        expect.objectContaining({
          quantity: 1,
          lineTotal: '40.00',
          isGood: true,
        }),
        expect.objectContaining({
          description: 'Envío: Capital',
          lineTotal: '25.00',
          isGood: false,
        }),
      ]);
      const other = await createCustomer(prisma);
      const otherTokens = await login(app, 'store', other.email);
      await http()
        .get(`/api/v1/store/orders/${paid.id}/receipt`)
        .set(bearer(otherTokens))
        .expect(404);

      const finance = await staff('FINANCE');
      const invoiceId = receipt.body.id;
      const fel = (body: object) =>
        http()
          .put(`/api/v1/admin/billing/invoices/${invoiceId}/fel`)
          .set(bearer(finance))
          .send(body);
      await fel({
        authorizationUuid: 'no-uuid',
        series: 'A',
        number: '1',
        certifier: 'X',
        certifiedAt: new Date().toISOString(),
      }).expect(400);
      const uuid = randomUUID();
      const certified = await fel({
        authorizationUuid: uuid,
        series: 'fa1b2c3d',
        number: '123456789',
        certifier: 'Certificador S.A.',
        certifiedAt: new Date().toISOString(),
      }).expect(200);
      expect(certified.body.fel).toMatchObject({
        status: 'CERTIFIED',
        series: 'FA1B2C3D',
        number: '123456789',
      });

      // El mismo número de autorización no se registra en otro comprobante.
      const second = await paidOrder(1);
      const secondInvoice = await invoiceOf(second.id);
      await http()
        .put(`/api/v1/admin/billing/invoices/${secondInvoice!.id}/fel`)
        .set(bearer(finance))
        .send({
          authorizationUuid: uuid,
          series: 'B',
          number: '2',
          certifier: 'X',
          certifiedAt: new Date().toISOString(),
        })
        .expect(409);

      const detail = await http()
        .get(`/api/v1/store/orders/${paid.id}`)
        .set(bearer(customer))
        .expect(200);
      expect(detail.body.receipt).toMatchObject({
        felStatus: 'CERTIFIED',
        felSeries: 'FA1B2C3D',
      });

      const list = await http()
        .get('/api/v1/admin/billing/invoices?felStatus=PENDING')
        .set(bearer(finance))
        .expect(200);
      expect(list.body.total).toBe(1);
      const sales = await staff('SALES');
      await http()
        .get('/api/v1/admin/billing/invoices')
        .set(bearer(sales))
        .expect(403);
    });

    it('contra entrega emite el comprobante al entregar; cancelar un pedido pagado lo anula', async () => {
      const cod = await placeOrder('CASH_ON_DELIVERY', 1);
      for (const [action, body] of [
        ['confirm', {}],
        ['prepare', {}],
        ['dispatch', { courierId }],
      ] as const) {
        await http()
          .post(`/api/v1/admin/orders/${cod.id}/${action}`)
          .set(bearer(admin))
          .send(body)
          .expect(200);
      }
      expect(await invoiceOf(cod.id)).toBeNull();
      await http()
        .post(`/api/v1/admin/orders/${cod.id}/deliver`)
        .set(bearer(admin))
        .send({ collectedAmount: cod.total })
        .expect(200);
      expect((await invoiceOf(cod.id))?.status).toBe('ISSUED');

      const paid = await paidOrder(1);
      await http()
        .post(`/api/v1/admin/orders/${paid.id}/cancel`)
        .set(bearer(admin))
        .send({ reason: 'Sin existencia física' })
        .expect(200);
      const voided = await invoiceOf(paid.id);
      expect(voided).toMatchObject({
        status: 'VOIDED',
        felStatus: 'NOT_APPLICABLE',
      });
      expect(voided?.voidReason).toContain('Sin existencia física');
      await http()
        .put(`/api/v1/admin/billing/invoices/${voided!.id}/fel`)
        .set(bearer(admin))
        .send({
          authorizationUuid: randomUUID(),
          series: 'A',
          number: '1',
          certifier: 'X',
          certifiedAt: new Date().toISOString(),
        })
        .expect(409);

      const codInvoice = await invoiceOf(cod.id);
      await http()
        .post(`/api/v1/admin/billing/invoices/${codInvoice!.id}/void`)
        .set(bearer(admin))
        .send({})
        .expect(400);
      await http()
        .post(`/api/v1/admin/billing/invoices/${codInvoice!.id}/void`)
        .set(bearer(admin))
        .send({ reason: 'Error de datos' })
        .expect(200);
      await http()
        .post(`/api/v1/admin/billing/invoices/${codInvoice!.id}/void`)
        .set(bearer(admin))
        .send({ reason: 'Otra vez' })
        .expect(409);
    });

    it('reporte de ingresos: recibido − reembolsado, y lo facturado del periodo', async () => {
      const paid = await paidOrder(2); // 80 + 25 = 105
      const cod = await placeOrder('CASH_ON_DELIVERY', 1); // 40 + 25 = 65
      for (const [action, body] of [
        ['confirm', {}],
        ['prepare', {}],
        ['dispatch', { courierId }],
        ['deliver', { collectedAmount: '60.00', note: 'Descuento acordado' }],
      ] as const) {
        await http()
          .post(`/api/v1/admin/orders/${cod.id}/${action}`)
          .set(bearer(admin))
          .send(body)
          .expect(200);
      }
      const refund = await http()
        .post(`/api/v1/admin/payments/${paid.paymentId}/refunds`)
        .set(bearer(admin))
        .send({ amount: '20.00', method: 'BANK_TRANSFER', reason: 'Ajuste' })
        .expect(201);
      await http()
        .post(`/api/v1/admin/refunds/${refund.body.id}/complete`)
        .set(bearer(admin))
        .send({ reference: 'TRF-1' })
        .expect(200);

      const today = todayInBusinessZone();
      const report = await http()
        .get(`/api/v1/admin/billing/income?from=${today}&to=${today}`)
        .set(bearer(admin))
        .expect(200);
      expect(report.body).toMatchObject({
        received: '165.00',
        receivedByMethod: { bankTransfer: '105.00', cashOnDelivery: '60.00' },
        receivedCount: 2,
        refunded: '20.00',
        net: '145.00',
        invoicesIssued: 2,
        invoicedTotal: '170.00',
        felPending: 2,
      });
      await http()
        .get(`/api/v1/admin/billing/income?from=${today}&to=2020-01-01`)
        .set(bearer(admin))
        .expect(400);
    });
  });
});
