import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { NotificationDispatcherService } from '../src/modules/notifications/notification-dispatcher.service.js';
import { ReservationExpiryService } from '../src/modules/orders/reservation-expiry.service.js';
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
  resetDatabase,
  type Tokens,
} from './support/fixtures.js';

describe('Carrito y checkout (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let mail: RecordingMailService;
  let customer: Tokens;
  let customerId: string;
  let customerEmail: string;
  let addressId: string;
  let shippingId: string;
  const http = () => request(app.getHttpServer());

  const addToCart = (tokens: Tokens, productId: string, quantity: number) =>
    http()
      .post('/api/v1/store/cart/items')
      .set(bearer(tokens))
      .send({ productId, quantity });

  const cartTotal = async (tokens: Tokens, methodId = shippingId) =>
    (
      await http()
        .get(`/api/v1/store/cart?shippingMethodId=${methodId}`)
        .set(bearer(tokens))
        .expect(200)
    ).body.summary.total as string;

  const placeOrder = (
    tokens: Tokens,
    body: Record<string, unknown>,
    key: string = randomUUID(),
  ) =>
    http()
      .post('/api/v1/store/orders')
      .set(bearer(tokens))
      .set('Idempotency-Key', key)
      .send(body);

  /** Confirma el carrito con el total que muestra, y espera `status`. */
  const checkout = async (
    status: number,
    tokens: Tokens = customer,
    extra: Record<string, unknown> = {},
  ) =>
    placeOrder(tokens, {
      addressId,
      shippingMethodId: shippingId,
      paymentMethod: 'BANK_TRANSFER',
      expectedTotal: await cartTotal(tokens),
      ...extra,
    }).expect(status);

  const lotsOf = (productId: string) =>
    prisma.lot.findMany({
      where: { productId },
      orderBy: { lotNumber: 'asc' },
      select: { lotNumber: true, qtyOnHand: true, qtyReserved: true },
    });

  beforeAll(async () => {
    ({ app, prisma, mail } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    mail.clear();
    const user = await createCustomer(prisma);
    customerId = user.id;
    customerEmail = user.email;
    customer = await login(app, 'store', user.email);
    addressId = (await createAddress(prisma, user.id)).id;
    shippingId = (await createShippingMethod(prisma)).id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('carrito', () => {
    it('agrega, acumula, cambia cantidades y calcula importes en el backend', async () => {
      const product = await createSellableProduct(prisma, { price: '30.00' });
      await addToCart(customer, product.id, 2).expect(200);
      const cart = await addToCart(customer, product.id, 1).expect(200);
      expect(cart.body.lines).toHaveLength(1);
      expect(cart.body.lines[0]).toMatchObject({
        quantity: 3,
        unitPrice: '30.00',
        lineTotal: '90.00',
        issue: null,
      });
      expect(cart.body.summary).toMatchObject({
        itemCount: 3,
        subtotal: '90.00',
        taxTotal: '9.64',
        shippingCost: null,
        total: '90.00',
      });

      const withShipping = await http()
        .get(`/api/v1/store/cart?shippingMethodId=${shippingId}`)
        .set(bearer(customer))
        .expect(200);
      expect(withShipping.body.summary).toMatchObject({
        shippingCost: '25.00',
        taxTotal: '12.32',
        total: '115.00',
      });
      expect(withShipping.body.canCheckout).toBe(true);

      await http()
        .patch(`/api/v1/store/cart/items/${product.id}`)
        .set(bearer(customer))
        .send({ quantity: 1 })
        .expect(200);
      const count = await http()
        .get('/api/v1/store/cart/count')
        .set(bearer(customer))
        .expect(200);
      expect(count.body.count).toBe(1);

      const removed = await http()
        .delete(`/api/v1/store/cart/items/${product.id}`)
        .set(bearer(customer))
        .expect(200);
      expect(removed.body.lines).toEqual([]);
    });

    it('rechaza productos con receta, no habilitados, agotados o por encima del máximo', async () => {
      const prescription = await createSellableProduct(prisma, {
        overrides: { saleCondition: 'PRESCRIPTION', onlineSaleEnabled: false },
      });
      await addToCart(customer, prescription.id, 1).expect(400);

      const notApproved = await createSellableProduct(prisma, {
        overrides: { onlineSaleEnabled: false },
      });
      await addToCart(customer, notApproved.id, 1).expect(400);

      // Solo el lote en cuarentena y el que vence en menos de 30 días tienen existencia.
      const unsellable = await createSellableProduct(prisma, {
        lots: [
          { qty: 5, status: 'QUARANTINE' },
          { qty: 5, expiresInDays: 10 },
        ],
      });
      await addToCart(customer, unsellable.id, 1).expect(409);

      const scarce = await createSellableProduct(prisma, {
        lots: [{ qty: 3 }],
      });
      const tooMany = await addToCart(customer, scarce.id, 4).expect(409);
      expect(tooMany.body.message).toContain('3 unidad');

      const plenty = await createSellableProduct(prisma, {
        lots: [{ qty: 100 }],
      });
      await addToCart(customer, plenty.id, 11).expect(409);
      await addToCart(customer, plenty.id, 10).expect(200);
    });

    it('marca las líneas que dejaron de poder comprarse y las excluye del total', async () => {
      const a = await createSellableProduct(prisma, { price: '10.00' });
      const b = await createSellableProduct(prisma, { price: '20.00' });
      await addToCart(customer, a.id, 1).expect(200);
      await addToCart(customer, b.id, 1).expect(200);
      await prisma.product.update({
        where: { id: b.id },
        data: { onlineSaleEnabled: false },
      });

      const cart = await http()
        .get('/api/v1/store/cart')
        .set(bearer(customer))
        .expect(200);
      const lineB = cart.body.lines.find(
        (l: { productId: string }) => l.productId === b.id,
      );
      expect(lineB.issue).toMatch(/no está habilitado/);
      expect(cart.body.summary.total).toBe('10.00');
      expect(cart.body.canCheckout).toBe(false);
    });

    it('solo lo usan clientes autenticados', async () => {
      await http().get('/api/v1/store/cart').expect(401);
      const staff = await login(
        app,
        'admin',
        (await createStaff(prisma, ['ADMIN'])).email,
      );
      await http().get('/api/v1/store/cart').set(bearer(staff)).expect(403);
    });
  });

  describe('checkout', () => {
    it('crea el pedido con copias, reserva por FEFO, deja el pago pendiente y vacía el carrito', async () => {
      // L-x-1 vence en 20 días (no vendible), L-x-2 en 200, L-x-3 en 100: FEFO toma L-x-3.
      const product = await createSellableProduct(prisma, {
        name: 'Protector solar',
        price: '30.00',
        lots: [
          { qty: 10, expiresInDays: 20 },
          { qty: 10, expiresInDays: 200 },
          { qty: 10, expiresInDays: 100 },
        ],
      });
      await addToCart(customer, product.id, 3).expect(200);

      const res = await checkout(201);
      expect(res.body).toMatchObject({
        status: 'PENDING_PAYMENT',
        paymentMethod: 'BANK_TRANSFER',
        subtotal: '90.00',
        shippingCost: '25.00',
        taxTotal: '12.32',
        total: '115.00',
        billingTaxId: 'CF',
        billingName: 'Consumidor final',
        payment: { status: 'PENDING', amount: '115.00' },
        shipping: { methodName: 'Capital', municipality: 'Guatemala' },
      });
      expect(res.body.items).toEqual([
        expect.objectContaining({
          productName: 'Protector solar',
          quantity: 3,
          unitPrice: '30.00',
          lineTotal: '90.00',
          lineTax: '9.64',
        }),
      ]);
      expect(res.body.history).toEqual([
        expect.objectContaining({
          fromStatus: null,
          toStatus: 'PENDING_PAYMENT',
        }),
      ]);
      const hours =
        (new Date(res.body.reservationExpiresAt).getTime() - Date.now()) /
        3_600_000;
      expect(hours).toBeGreaterThan(23.9);
      expect(hours).toBeLessThanOrEqual(24);

      const lots = await lotsOf(product.id);
      expect(lots.map((l) => l.qtyReserved)).toEqual([0, 0, 3]);
      const reservations = await prisma.stockReservation.findMany();
      expect(reservations).toEqual([
        expect.objectContaining({ quantity: 3, status: 'ACTIVE' }),
      ]);

      const cart = await http()
        .get('/api/v1/store/cart')
        .set(bearer(customer))
        .expect(200);
      expect(cart.body.lines).toEqual([]);
      // La confirmación quedó en la bandeja de salida con el pedido y se envía
      // con el despachador.
      const queued = await prisma.notificationLog.findMany();
      expect(queued).toEqual([
        expect.objectContaining({
          type: 'ORDER_PLACED',
          status: 'PENDING',
          recipient: customerEmail.toLowerCase(),
          relatedId: res.body.id,
        }),
      ]);
      await app.get(NotificationDispatcherService).dispatchDue();
      expect(mail.lastTo(customerEmail)?.subject).toBe(
        'Recibimos su pedido PED-000001',
      );

      // El precio del pedido no cambia si después cambia el del producto.
      await prisma.product.update({
        where: { id: product.id },
        data: { price: '99.00', name: 'Otro nombre' },
      });
      const detail = await http()
        .get(`/api/v1/store/orders/${res.body.id}`)
        .set(bearer(customer))
        .expect(200);
      expect(detail.body.items[0]).toMatchObject({
        productName: 'Protector solar',
        unitPrice: '30.00',
      });
      const list = await http()
        .get('/api/v1/store/orders')
        .set(bearer(customer))
        .expect(200);
      expect(list.body).toMatchObject({ total: 1 });
    });

    it('reparte la cantidad entre lotes por FEFO cuando uno no alcanza', async () => {
      const product = await createSellableProduct(prisma, {
        lots: [
          { qty: 2, expiresInDays: 60 },
          { qty: 10, expiresInDays: 300 },
        ],
      });
      await addToCart(customer, product.id, 5).expect(200);
      await checkout(201);
      expect((await lotsOf(product.id)).map((l) => l.qtyReserved)).toEqual([
        2, 3,
      ]);
    });

    it('rechaza el pedido si el total cambió y no reserva nada', async () => {
      const product = await createSellableProduct(prisma, { price: '30.00' });
      await addToCart(customer, product.id, 1).expect(200);
      const seen = await cartTotal(customer);
      await prisma.product.update({
        where: { id: product.id },
        data: { price: '35.00' },
      });

      const res = await placeOrder(customer, {
        addressId,
        shippingMethodId: shippingId,
        paymentMethod: 'BANK_TRANSFER',
        expectedTotal: seen,
      }).expect(409);
      expect(res.body).toMatchObject({ code: 'TOTAL_CHANGED', total: '60.00' });
      expect(await prisma.order.count()).toBe(0);
      expect((await lotsOf(product.id))[0].qtyReserved).toBe(0);
      expect(await prisma.cartItem.count()).toBe(1);
    });

    it('la misma clave de idempotencia no duplica el pedido', async () => {
      const product = await createSellableProduct(prisma);
      await addToCart(customer, product.id, 1).expect(200);
      const body = {
        addressId,
        shippingMethodId: shippingId,
        paymentMethod: 'BANK_TRANSFER',
        expectedTotal: await cartTotal(customer),
      };
      const key = randomUUID();
      const first = await placeOrder(customer, body, key).expect(201);
      const again = await placeOrder(customer, body, key).expect(201);
      expect(again.body.id).toBe(first.body.id);
      expect(await prisma.order.count()).toBe(1);
      expect((await prisma.order.findFirstOrThrow()).customerId).toBe(
        customerId,
      );
      expect((await lotsOf(product.id))[0].qtyReserved).toBe(1);

      await http()
        .post('/api/v1/store/orders')
        .set(bearer(customer))
        .send(body)
        .expect(400);
    });

    it('contra entrega: queda pendiente de confirmación y respeta el método de envío', async () => {
      const product = await createSellableProduct(prisma);
      await addToCart(customer, product.id, 1).expect(200);
      const noCod = await createShippingMethod(prisma, {
        name: 'Departamentos',
        cost: '40.00',
        allowsCashOnDelivery: false,
      });
      await placeOrder(customer, {
        addressId,
        shippingMethodId: noCod.id,
        paymentMethod: 'CASH_ON_DELIVERY',
        expectedTotal: await cartTotal(customer, noCod.id),
      }).expect(400);

      const res = await checkout(201, customer, {
        paymentMethod: 'CASH_ON_DELIVERY',
        billingTaxId: '1234567-K',
        billingName: 'Empresa S.A.',
        notes: 'Llamar antes de llegar',
      });
      expect(res.body).toMatchObject({
        status: 'PENDING_CONFIRMATION',
        billingTaxId: '1234567K',
        billingName: 'Empresa S.A.',
        customerNotes: 'Llamar antes de llegar',
        payment: { method: 'CASH_ON_DELIVERY', status: 'PENDING' },
      });
      const hours =
        (new Date(res.body.reservationExpiresAt).getTime() - Date.now()) /
        3_600_000;
      expect(Math.round(hours)).toBe(48);
    });

    it('valida correo verificado, dirección propia, carrito y disponibilidad', async () => {
      const product = await createSellableProduct(prisma, {
        lots: [{ qty: 5 }],
      });

      // Correo sin verificar (D13).
      const unverified = await createCustomer(prisma, { emailVerified: false });
      const unverifiedTokens = await login(app, 'store', unverified.email);
      await addToCart(unverifiedTokens, product.id, 1).expect(200);
      const ownAddress = await createAddress(prisma, unverified.id);
      await placeOrder(unverifiedTokens, {
        addressId: ownAddress.id,
        shippingMethodId: shippingId,
        paymentMethod: 'BANK_TRANSFER',
        expectedTotal: await cartTotal(unverifiedTokens),
      }).expect(403);

      // Carrito vacío.
      await checkout(400);

      // Dirección de otro cliente.
      await addToCart(customer, product.id, 2).expect(200);
      await checkout(404, customer, { addressId: ownAddress.id });

      // La existencia bajó después de agregar al carrito.
      await prisma.lot.updateMany({
        where: { productId: product.id },
        data: { qtyOnHand: 1 },
      });
      const res = await placeOrder(customer, {
        addressId,
        shippingMethodId: shippingId,
        paymentMethod: 'BANK_TRANSFER',
        expectedTotal: '85.00',
      }).expect(409);
      expect(res.body).toMatchObject({
        code: 'INSUFFICIENT_STOCK',
        available: 1,
      });
      expect(await prisma.order.count()).toBe(0);

      // El producto dejó de venderse en línea.
      await prisma.product.update({
        where: { id: product.id },
        data: { onlineSaleEnabled: false },
      });
      await checkout(400, customer, { expectedTotal: '85.00' });
    });

    it('checkouts simultáneos nunca reservan más de lo disponible', async () => {
      const product = await createSellableProduct(prisma, {
        lots: [
          { qty: 4, expiresInDays: 90 },
          { qty: 6, expiresInDays: 200 },
        ],
      });
      const buyers = await Promise.all(
        Array.from({ length: 6 }, async () => {
          const user = await createCustomer(prisma);
          const tokens = await login(app, 'store', user.email);
          const address = await createAddress(prisma, user.id);
          await addToCart(tokens, product.id, 3).expect(200);
          return { tokens, addressId: address.id };
        }),
      );

      const results = await Promise.all(
        buyers.map((b) =>
          placeOrder(b.tokens, {
            addressId: b.addressId,
            shippingMethodId: shippingId,
            paymentMethod: 'BANK_TRANSFER',
            expectedTotal: '115.00',
          }),
        ),
      );
      const statuses = results.map((r) => r.status);
      expect(statuses.filter((s) => s === 201)).toHaveLength(3);
      expect(statuses.filter((s) => s === 409)).toHaveLength(3);

      const lots = await lotsOf(product.id);
      expect(lots.reduce((n, l) => n + l.qtyReserved, 0)).toBe(9);
      expect(lots.every((l) => l.qtyReserved <= l.qtyOnHand)).toBe(true);
      const reserved = await prisma.stockReservation.aggregate({
        _sum: { quantity: true },
        where: { status: 'ACTIVE' },
      });
      expect(reserved._sum.quantity).toBe(9);
    });
  });

  describe('vencimiento de reservas', () => {
    it('libera la existencia, vence el pedido y cancela su pago pendiente', async () => {
      const product = await createSellableProduct(prisma, {
        lots: [{ qty: 5 }],
      });
      await addToCart(customer, product.id, 2).expect(200);
      const placed = await checkout(201);

      const other = await createSellableProduct(prisma);
      await addToCart(customer, other.id, 1).expect(200);
      const inReview = await checkout(201);
      // Con comprobante en revisión la reserva no vence (Fase 7 hará la transición).
      await prisma.order.update({
        where: { id: inReview.body.id },
        data: { status: 'PAYMENT_IN_REVIEW' },
      });

      const expiry = app.get(ReservationExpiryService);
      expect(await expiry.expireDue()).toBe(0);
      await prisma.order.updateMany({
        data: { reservationExpiresAt: new Date(Date.now() - 1000) },
      });
      expect(await expiry.expireDue()).toBe(1);

      const order = await http()
        .get(`/api/v1/store/orders/${placed.body.id}`)
        .set(bearer(customer))
        .expect(200);
      expect(order.body.status).toBe('EXPIRED');
      expect(order.body.payment.status).toBe('CANCELLED');
      expect(order.body.history.at(-1)).toMatchObject({
        fromStatus: 'PENDING_PAYMENT',
        toStatus: 'EXPIRED',
      });
      expect((await lotsOf(product.id))[0].qtyReserved).toBe(0);
      expect((await lotsOf(other.id))[0].qtyReserved).toBe(1);
      const statuses = await prisma.stockReservation.findMany({
        select: { status: true },
        orderBy: { createdAt: 'asc' },
      });
      expect(statuses.map((s) => s.status)).toEqual(['EXPIRED', 'ACTIVE']);

      // Lo liberado se puede volver a comprar.
      await addToCart(customer, product.id, 5).expect(200);
      expect(await expiry.expireDue()).toBe(0);
    });

    it('el historial de estados no se puede modificar', async () => {
      const product = await createSellableProduct(prisma);
      await addToCart(customer, product.id, 1).expect(200);
      await checkout(201);
      await expect(prisma.orderStatusHistory.deleteMany()).rejects.toThrow();
    });
  });
});
