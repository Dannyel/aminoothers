import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { todayInBusinessZone } from '../src/common/utils/dates.js';
import { ReservationExpiryService } from '../src/modules/orders/reservation-expiry.service.js';
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

describe('Ventas, pagos, envíos y devoluciones (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Tokens;
  let customer: Tokens;
  let customerId: string;
  let addressId: string;
  let shippingId: string;
  let courierId: string;
  let bankAccountId: string;
  let productId: string;
  const http = () => request(app.getHttpServer());
  const today = () => todayInBusinessZone();

  const staff = async (role: string) =>
    login(app, 'admin', (await createStaff(prisma, [role])).email);

  /** Pedido nuevo del cliente con `quantity` unidades del producto. */
  const placeOrder = async (
    paymentMethod: 'BANK_TRANSFER' | 'CASH_ON_DELIVERY',
    quantity = 2,
    tokens: Tokens = customer,
    address: string = addressId,
  ) => {
    await http()
      .post('/api/v1/store/cart/items')
      .set(bearer(tokens))
      .send({ productId, quantity })
      .expect(200);
    const cart = await http()
      .get(`/api/v1/store/cart?shippingMethodId=${shippingId}`)
      .set(bearer(tokens))
      .expect(200);
    const res = await http()
      .post('/api/v1/store/orders')
      .set(bearer(tokens))
      .set('Idempotency-Key', randomUUID())
      .send({
        addressId: address,
        shippingMethodId: shippingId,
        paymentMethod,
        expectedTotal: cart.body.summary.total,
      })
      .expect(201);
    return res.body as { id: string; total: string };
  };

  const submitTransfer = (
    orderId: string,
    reference: string,
    tokens: Tokens = customer,
    file: Buffer = PNG,
  ) =>
    http()
      .post(`/api/v1/store/orders/${orderId}/transfer`)
      .set(bearer(tokens))
      .field('bankAccountId', bankAccountId)
      .field('bankReference', reference)
      .field('transferDate', today())
      .attach('file', file, 'comprobante.png');

  const adminOrder = async (id: string) =>
    (
      await http()
        .get(`/api/v1/admin/orders/${id}`)
        .set(bearer(admin))
        .expect(200)
    ).body;

  const act = (id: string, action: string, body: object = {}, tokens = admin) =>
    http()
      .post(`/api/v1/admin/orders/${id}/${action}`)
      .set(bearer(tokens))
      .send(body);

  const openPaymentId = async (orderId: string) =>
    (
      await prisma.payment.findFirstOrThrow({
        where: {
          orderId,
          status: { in: ['PENDING', 'IN_REVIEW', 'APPROVED'] },
        },
      })
    ).id;

  /** Transferencia aprobada, preparada y despachada. */
  const shippedTransferOrder = async (quantity = 2) => {
    const order = await placeOrder('BANK_TRANSFER', quantity);
    await submitTransfer(order.id, `REF-${randomUUID().slice(0, 8)}`).expect(
      200,
    );
    await http()
      .post(`/api/v1/admin/payments/${await openPaymentId(order.id)}/approve`)
      .set(bearer(admin))
      .expect(204);
    await act(order.id, 'prepare').expect(200);
    await act(order.id, 'dispatch', {
      courierId,
      trackingNumber: `G${Date.now()}`,
    }).expect(200);
    return order;
  };

  const lots = () =>
    prisma.lot.findMany({
      where: { productId },
      orderBy: { lotNumber: 'asc' },
      select: { id: true, qtyOnHand: true, qtyReserved: true, status: true },
    });

  const assertLedgerConsistent = async () => {
    // Los lotes de prueba nacen sin movimientos: se compara contra el saldo inicial de 20.
    const rows = await prisma.$queryRaw<Array<{ id: string; diff: number }>>`
      SELECT l.id, (l.qty_on_hand - 20 - COALESCE(sum(m.quantity), 0))::int AS diff
      FROM lots l LEFT JOIN inventory_movements m ON m.lot_id = l.id
      WHERE l.product_id = ${productId}::uuid
      GROUP BY l.id, l.qty_on_hand`;
    expect(rows.every((r) => r.diff === 0)).toBe(true);
  };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    admin = await staff('ADMIN');
    const user = await createCustomer(prisma);
    customerId = user.id;
    customer = await login(app, 'store', user.email);
    addressId = (await createAddress(prisma, user.id)).id;
    shippingId = (await createShippingMethod(prisma)).id;
    productId = (
      await createSellableProduct(prisma, {
        price: '50.00',
        lots: [
          { qty: 20, expiresInDays: 120 },
          { qty: 20, expiresInDays: 400 },
        ],
      })
    ).id;
    courierId = (
      await prisma.courier.create({
        data: {
          name: 'Mensajería Rápida',
          trackingUrlTemplate: 'https://rastreo.example/guia/{tracking}',
        },
      })
    ).id;
    bankAccountId = (
      await prisma.bankAccount.create({
        data: {
          bankName: 'Banco Industrial',
          accountNumber: '123-456789-0',
          accountType: 'Monetaria',
          accountHolder: 'Farmacia S.A.',
        },
      })
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('transferencias', () => {
    it('verificación manual: rechazo con nuevo plazo, reintento y aprobación', async () => {
      const accounts = await http()
        .get('/api/v1/store/bank-accounts')
        .expect(200);
      expect(accounts.body).toEqual([
        expect.objectContaining({ bankName: 'Banco Industrial' }),
      ]);
      const order = await placeOrder('BANK_TRANSFER');
      expect(
        (
          await http()
            .get(`/api/v1/store/orders/${order.id}`)
            .set(bearer(customer))
            .expect(200)
        ).body,
      ).toMatchObject({ canSubmitTransfer: true, canCancel: true });

      await submitTransfer(order.id, 'X', customer).expect(400);
      await submitTransfer(
        order.id,
        'REF-0001',
        customer,
        Buffer.from('no es imagen'),
      ).expect(400);
      const submitted = await submitTransfer(order.id, 'REF-0001').expect(200);
      expect(submitted.body).toMatchObject({
        status: 'PAYMENT_IN_REVIEW',
        canSubmitTransfer: false,
        payment: {
          status: 'IN_REVIEW',
          bankName: 'Banco Industrial',
          bankReference: 'REF-0001',
        },
      });

      // Con el comprobante en revisión la reserva no vence.
      await prisma.order.update({
        where: { id: order.id },
        data: { reservationExpiresAt: new Date(Date.now() - 1000) },
      });
      expect(await app.get(ReservationExpiryService).expireDue()).toBe(0);

      const finance = await staff('FINANCE');
      const pending = await http()
        .get('/api/v1/admin/payments')
        .set(bearer(finance))
        .expect(200);
      expect(pending.body.items).toEqual([
        expect.objectContaining({
          hasProof: true,
          order: expect.objectContaining({ id: order.id }),
        }),
      ]);
      const paymentId = pending.body.items[0].id;
      const proof = await http()
        .get(`/api/v1/admin/payments/${paymentId}/proof`)
        .set(bearer(finance))
        .expect(200);
      expect(proof.headers['content-type']).toBe('image/png');
      // El comprobante es privado: no se sirve por /files.
      const file = await prisma.payment.findUniqueOrThrow({
        where: { id: paymentId },
      });
      await http().get(`/api/v1/files/${file.proofFileId}`).expect(404);

      const sales = await staff('SALES');
      await http()
        .post(`/api/v1/admin/payments/${paymentId}/approve`)
        .set(bearer(sales))
        .expect(403);

      await http()
        .post(`/api/v1/admin/payments/${paymentId}/reject`)
        .set(bearer(finance))
        .send({ reason: 'El monto no coincide con el estado de cuenta' })
        .expect(204);
      const rejected = await http()
        .get(`/api/v1/store/orders/${order.id}`)
        .set(bearer(customer))
        .expect(200);
      expect(rejected.body).toMatchObject({
        status: 'PENDING_PAYMENT',
        canSubmitTransfer: true,
        paymentRejectionReason: 'El monto no coincide con el estado de cuenta',
        payment: { status: 'PENDING' },
      });
      expect(
        new Date(rejected.body.reservationExpiresAt).getTime(),
      ).toBeGreaterThan(Date.now() + 23 * 3_600_000);

      // La misma referencia se puede usar de nuevo (el intento anterior se rechazó)…
      await submitTransfer(order.id, 'REF-0001').expect(200);
      // …pero no en otro pedido mientras siga vigente.
      const other = await placeOrder('BANK_TRANSFER');
      const duplicate = await submitTransfer(other.id, 'REF-0001').expect(409);
      expect(duplicate.body.message).toContain('referencia');

      await http()
        .post(`/api/v1/admin/payments/${await openPaymentId(order.id)}/approve`)
        .set(bearer(finance))
        .expect(204);
      const approved = await adminOrder(order.id);
      expect(approved.status).toBe('CONFIRMED');
      expect(
        approved.payments.map((p: { status: string }) => p.status),
      ).toEqual(['APPROVED', 'REJECTED']);
      expect(approved.payments[0].verifiedBy.name).toBe('Personal Prueba');
      expect(approved.actions).toEqual(['prepare', 'cancel']);
    });

    it('no admite transferencias en pedidos vencidos ni contra entrega', async () => {
      const cod = await placeOrder('CASH_ON_DELIVERY', 1);
      await submitTransfer(cod.id, 'REF-COD1').expect(409);
      const order = await placeOrder('BANK_TRANSFER', 1);
      await prisma.order.update({
        where: { id: order.id },
        data: { reservationExpiresAt: new Date(Date.now() - 1000) },
      });
      await submitTransfer(order.id, 'REF-LATE').expect(409);
      expect(await prisma.file.count()).toBe(0);
    });
  });

  describe('despacho y entrega', () => {
    it('el despacho descuenta los lotes reservados con trazabilidad y se sigue hasta la entrega', async () => {
      const order = await placeOrder('BANK_TRANSFER', 3);
      await act(order.id, 'dispatch', { courierId }).expect(409);
      await submitTransfer(order.id, 'REF-1000').expect(200);
      await http()
        .post(`/api/v1/admin/payments/${await openPaymentId(order.id)}/approve`)
        .set(bearer(admin))
        .expect(204);
      await act(order.id, 'deliver').expect(409);
      await act(order.id, 'prepare').expect(200);

      const warehouse = await staff('WAREHOUSE');
      const dispatched = await act(
        order.id,
        'dispatch',
        { courierId, trackingNumber: 'GUIA-123', courierCost: '18.00' },
        warehouse,
      ).expect(200);
      expect(dispatched.body).toMatchObject({
        status: 'SHIPPED',
        adminShipment: {
          courierName: 'Mensajería Rápida',
          trackingNumber: 'GUIA-123',
          trackingUrl: 'https://rastreo.example/guia/GUIA-123',
          courierCost: '18.00',
          status: 'DISPATCHED',
        },
      });
      expect(dispatched.body.reservations).toEqual([
        expect.objectContaining({ quantity: 3, status: 'CONSUMED' }),
      ]);
      expect((await lots()).map((l) => [l.qtyOnHand, l.qtyReserved])).toEqual([
        [17, 0],
        [20, 0],
      ]);
      const movements = await prisma.inventoryMovement.findMany();
      expect(movements).toEqual([
        expect.objectContaining({
          type: 'SALE',
          quantity: -3,
          referenceType: 'ORDER',
          referenceId: order.id,
        }),
      ]);
      const reservation = await prisma.stockReservation.findFirstOrThrow();
      expect(reservation.consumedMovementId).toBe(movements[0].id);
      await assertLedgerConsistent();

      // La guía no se puede repetir en otro pedido de la misma mensajería.
      const second = await placeOrder('BANK_TRANSFER', 1);
      await submitTransfer(second.id, 'REF-2000').expect(200);
      await http()
        .post(
          `/api/v1/admin/payments/${await openPaymentId(second.id)}/approve`,
        )
        .set(bearer(admin))
        .expect(204);
      await act(second.id, 'prepare').expect(200);
      await act(second.id, 'dispatch', {
        courierId,
        trackingNumber: 'GUIA-123',
      }).expect(409);

      await act(
        order.id,
        'shipment/events',
        {
          status: 'IN_TRANSIT',
          description: 'En ruta de entrega',
          location: 'Zona 10',
        },
        warehouse,
      ).expect(200);
      const delivered = await act(
        order.id,
        'deliver',
        { receivedByName: 'Portería' },
        warehouse,
      ).expect(200);
      expect(delivered.body.status).toBe('DELIVERED');
      expect(delivered.body.actions).toEqual(['createReturn']);

      const tracking = await http()
        .get(`/api/v1/store/orders/${order.id}`)
        .set(bearer(customer))
        .expect(200);
      expect(tracking.body.shipment).toMatchObject({
        status: 'DELIVERED',
        trackingUrl: 'https://rastreo.example/guia/GUIA-123',
        receivedByName: 'Portería',
      });
      expect(
        tracking.body.shipment.events.map((e: { status: string }) => e.status),
      ).toEqual(['DISPATCHED', 'IN_TRANSIT', 'DELIVERED']);
      expect(tracking.body.shipment).not.toHaveProperty('courierCost');
    });

    it('contra entrega: confirmación del personal y cobro obligatorio al entregar', async () => {
      const order = await placeOrder('CASH_ON_DELIVERY', 2);
      const sales = await staff('SALES');
      await act(order.id, 'confirm', {}, sales).expect(200);
      await act(order.id, 'prepare', {}, sales).expect(200);
      await act(order.id, 'dispatch', { courierId }, sales).expect(200);

      await act(order.id, 'deliver', {}, sales).expect(400);
      await act(
        order.id,
        'deliver',
        { collectedAmount: '120.00' },
        sales,
      ).expect(400);
      // Bodega despacha y entrega, pero no registra cobros.
      const warehouse = await staff('WAREHOUSE');
      await act(
        order.id,
        'deliver',
        { collectedAmount: order.total },
        warehouse,
      ).expect(409);

      const delivered = await act(
        order.id,
        'deliver',
        {
          collectedAmount: '120.00',
          note: 'Cliente pagó con descuento acordado',
        },
        sales,
      ).expect(200);
      expect(delivered.body.payments[0]).toMatchObject({
        status: 'APPROVED',
        collectedAmount: '120.00',
        collectionNote: 'Cliente pagó con descuento acordado',
      });
      expect(delivered.body.payments[0].collectedBy).not.toBeNull();
    });
  });

  describe('cancelaciones y reembolsos', () => {
    it('el cliente cancela antes de la confirmación y se liberan las reservas', async () => {
      const order = await placeOrder('BANK_TRANSFER', 4);
      expect((await lots())[0].qtyReserved).toBe(4);
      const res = await http()
        .post(`/api/v1/store/orders/${order.id}/cancel`)
        .set(bearer(customer))
        .send({ reason: 'Ya no lo necesito' })
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'CANCELLED',
        cancelReason: 'Ya no lo necesito',
        canCancel: false,
        payment: { status: 'CANCELLED' },
      });
      expect((await lots())[0].qtyReserved).toBe(0);
      expect((await prisma.stockReservation.findFirstOrThrow()).status).toBe(
        'RELEASED',
      );

      // Otro cliente no puede cancelar pedidos ajenos.
      const other = await createCustomer(prisma);
      const otherTokens = await login(app, 'store', other.email);
      const otherOrder = await placeOrder(
        'CASH_ON_DELIVERY',
        1,
        otherTokens,
        (await createAddress(prisma, other.id)).id,
      );
      await http()
        .post(`/api/v1/store/orders/${otherOrder.id}/cancel`)
        .set(bearer(customer))
        .send({})
        .expect(404);
      expect(customerId).not.toBe(other.id);
    });

    it('pagado y confirmado: solo el personal cancela y queda un reembolso que Finanzas completa', async () => {
      const order = await placeOrder('BANK_TRANSFER', 2);
      await submitTransfer(order.id, 'REF-3000').expect(200);
      const paymentId = await openPaymentId(order.id);
      await http()
        .post(`/api/v1/admin/payments/${paymentId}/approve`)
        .set(bearer(admin))
        .expect(204);
      await http()
        .post(`/api/v1/store/orders/${order.id}/cancel`)
        .set(bearer(customer))
        .send({})
        .expect(409);

      await act(order.id, 'cancel', {}).expect(400);
      const cancelled = await act(order.id, 'cancel', {
        reason: 'Sin cobertura en la zona',
      }).expect(200);
      expect(cancelled.body.status).toBe('CANCELLED');
      expect(cancelled.body.payments[0]).toMatchObject({
        status: 'APPROVED',
        refundableAmount: '0.00',
        refunds: [
          expect.objectContaining({ status: 'PENDING', amount: order.total }),
        ],
      });
      expect((await lots())[0].qtyReserved).toBe(0);

      const refundId = cancelled.body.payments[0].refunds[0].id;
      const finance = await staff('FINANCE');
      const done = await http()
        .post(`/api/v1/admin/refunds/${refundId}/complete`)
        .set(bearer(finance))
        .send({ reference: 'TRF-998877' })
        .expect(200);
      expect(done.body).toMatchObject({
        status: 'COMPLETED',
        reference: 'TRF-998877',
      });
      await http()
        .post(`/api/v1/admin/refunds/${refundId}/complete`)
        .set(bearer(finance))
        .send({ reference: 'X' })
        .expect(409);
      expect(
        (await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } }))
          .status,
      ).toBe('REFUNDED');
    });
  });

  describe('devoluciones', () => {
    it('devolución de un pedido entregado: inspección, reincorporación y reembolso parcial', async () => {
      const order = await shippedTransferOrder(4);
      await act(order.id, 'deliver').expect(200);
      const detail = await adminOrder(order.id);
      const itemId = detail.items[0].id;

      await act(order.id, 'returns', {
        reason: 'Empaque dañado',
        items: [{ orderItemId: itemId, quantity: 5 }],
      }).expect(400);
      const pharmacist = await staff('PHARMACIST');
      await act(
        order.id,
        'returns',
        { reason: 'x', items: [{ orderItemId: itemId, quantity: 1 }] },
        pharmacist,
      ).expect(403);

      const first = await act(order.id, 'returns', {
        reason: 'Producto equivocado',
        items: [{ orderItemId: itemId, quantity: 3 }],
      }).expect(201);
      expect(first.body).toMatchObject({
        status: 'REQUESTED',
        amount: '150.00',
      });
      // Rechazar libera las unidades para otra devolución.
      await http()
        .post(`/api/v1/admin/returns/${first.body.id}/reject`)
        .set(bearer(admin))
        .send({ reason: 'Fuera de política' })
        .expect(200);
      expect((await adminOrder(order.id)).items[0].quantityReturned).toBe(0);

      const ret = await act(order.id, 'returns', {
        reason: 'Empaque dañado',
        items: [{ orderItemId: itemId, quantity: 2 }],
      }).expect(201);
      const returnId = ret.body.id;
      await http()
        .post(`/api/v1/admin/returns/${returnId}/receive`)
        .set(bearer(admin))
        .expect(409);
      await http()
        .post(`/api/v1/admin/returns/${returnId}/approve`)
        .set(bearer(admin))
        .expect(200);
      const received = await http()
        .post(`/api/v1/admin/returns/${returnId}/receive`)
        .set(bearer(admin))
        .expect(200);
      expect(received.body.items).toEqual([
        expect.objectContaining({
          quantity: 2,
          disposition: 'PENDING_INSPECTION',
        }),
      ]);
      // Recibir no cambia el inventario.
      expect((await lots())[0].qtyOnHand).toBe(16);

      const returnItemId = received.body.items[0].id;
      const restocked = await http()
        .post(`/api/v1/admin/returns/${returnId}/items/${returnItemId}/inspect`)
        .set(bearer(pharmacist))
        .send({ disposition: 'RESTOCK', conditionNotes: 'Sellado e intacto' })
        .expect(200);
      expect(restocked.body.status).toBe('CLOSED');
      expect((await lots())[0].qtyOnHand).toBe(18);
      expect(
        await prisma.inventoryMovement.findFirst({
          where: { type: 'RETURN_RESTOCK' },
        }),
      ).toMatchObject({
        quantity: 2,
        referenceType: 'RETURN',
        referenceId: returnId,
      });
      await assertLedgerConsistent();

      const paymentId = await openPaymentId(order.id);
      await http()
        .post(`/api/v1/admin/payments/${paymentId}/refunds`)
        .set(bearer(admin))
        .send({
          amount: '999.00',
          method: 'BANK_TRANSFER',
          reason: 'Devolución',
          returnId,
        })
        .expect(400);
      const refund = await http()
        .post(`/api/v1/admin/payments/${paymentId}/refunds`)
        .set(bearer(admin))
        .send({
          amount: '100.00',
          method: 'BANK_TRANSFER',
          reason: 'Devolución DEV-1',
          returnId,
        })
        .expect(201);
      expect(refund.body).toMatchObject({
        status: 'PENDING',
        returnNumber: ret.body.number,
      });
      await http()
        .post(`/api/v1/admin/refunds/${refund.body.id}/complete`)
        .set(bearer(admin))
        .send({ reference: 'TRF-1' })
        .expect(200);
      expect(
        (await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } }))
          .status,
      ).toBe('PARTIALLY_REFUNDED');
    });

    it('no reincorpora unidades a un lote en cuarentena y respeta el plazo de devolución', async () => {
      const order = await shippedTransferOrder(2);
      await act(order.id, 'deliver').expect(200);
      const itemId = (await adminOrder(order.id)).items[0].id;
      const ret = await act(order.id, 'returns', {
        reason: 'Reacción alérgica',
        items: [{ orderItemId: itemId, quantity: 1 }],
      }).expect(201);
      await http()
        .post(`/api/v1/admin/returns/${ret.body.id}/approve`)
        .set(bearer(admin))
        .expect(200);
      const received = await http()
        .post(`/api/v1/admin/returns/${ret.body.id}/receive`)
        .set(bearer(admin))
        .expect(200);
      await prisma.lot.updateMany({
        where: { id: received.body.items[0].lotId },
        data: { status: 'QUARANTINE' },
      });
      const inspect = (disposition: string) =>
        http()
          .post(
            `/api/v1/admin/returns/${ret.body.id}/items/${received.body.items[0].id}/inspect`,
          )
          .set(bearer(admin))
          .send({ disposition });
      await inspect('RESTOCK').expect(400);
      await inspect('DESTROY').expect(200);
      await inspect('DESTROY').expect(409);

      // Pasado el plazo de 7 días ya no se registran devoluciones.
      await prisma.shipment.updateMany({
        data: { deliveredAt: new Date(Date.now() - 10 * 86_400_000) },
      });
      expect((await adminOrder(order.id)).actions).toEqual([]);
      await act(order.id, 'returns', {
        reason: 'Tarde',
        items: [{ orderItemId: itemId, quantity: 1 }],
      }).expect(409);
    });

    it('entrega fallida, reintento y paquete devuelto: devolución pendiente de inspección', async () => {
      const order = await placeOrder('CASH_ON_DELIVERY', 2);
      await act(order.id, 'confirm').expect(200);
      await act(order.id, 'prepare').expect(200);
      await act(order.id, 'dispatch', {
        courierId,
        trackingNumber: 'G-1',
      }).expect(200);
      await act(order.id, 'delivery-failed', {}).expect(400);
      await act(order.id, 'delivery-failed', { note: 'Nadie en casa' }).expect(
        200,
      );
      await act(order.id, 'redispatch', { trackingNumber: 'G-2' }).expect(200);
      await act(order.id, 'delivery-failed', {
        note: 'Dirección incorrecta',
      }).expect(200);
      const back = await act(order.id, 'return-to-store', {
        note: 'La mensajería devolvió el paquete',
      }).expect(200);

      expect(back.body).toMatchObject({
        status: 'RETURNED_TO_STORE',
        adminShipment: { status: 'RETURNED', trackingNumber: 'G-2' },
        payments: [expect.objectContaining({ status: 'CANCELLED' })],
        returns: [expect.objectContaining({ status: 'RECEIVED' })],
      });
      expect(back.body.returns[0].items).toEqual([
        expect.objectContaining({
          quantity: 2,
          disposition: 'PENDING_INSPECTION',
        }),
      ]);
      expect((await lots())[0].qtyOnHand).toBe(18);
      const list = await http()
        .get('/api/v1/admin/returns?status=RECEIVED')
        .set(bearer(admin))
        .expect(200);
      expect(list.body.total).toBe(1);
    });
  });

  describe('panel de pedidos', () => {
    it('lista con búsqueda y filtros; los clientes no acceden', async () => {
      const a = await placeOrder('BANK_TRANSFER', 1);
      await placeOrder('CASH_ON_DELIVERY', 1);
      const all = await http()
        .get('/api/v1/admin/orders')
        .set(bearer(admin))
        .expect(200);
      expect(all.body.total).toBe(2);
      const cod = await http()
        .get('/api/v1/admin/orders?paymentMethod=CASH_ON_DELIVERY')
        .set(bearer(admin))
        .expect(200);
      expect(cod.body.items).toEqual([
        expect.objectContaining({ status: 'PENDING_CONFIRMATION' }),
      ]);
      const byNumber = await http()
        .get('/api/v1/admin/orders?search=PED-000001')
        .set(bearer(admin))
        .expect(200);
      expect(byNumber.body.items.map((o: { id: string }) => o.id)).toEqual([
        a.id,
      ]);
      const byDate = await http()
        .get(`/api/v1/admin/orders?from=${today()}&to=${today()}`)
        .set(bearer(admin))
        .expect(200);
      expect(byDate.body.total).toBe(2);
      await http()
        .get('/api/v1/admin/orders')
        .set(bearer(customer))
        .expect(403);
    });
  });
});
