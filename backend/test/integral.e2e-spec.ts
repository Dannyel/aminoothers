import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { addDays, todayInBusinessZone } from '../src/common/utils/dates.js';
import { NotificationDispatcherService } from '../src/modules/notifications/notification-dispatcher.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import {
  createTestApp,
  type RecordingMailService,
} from './support/create-app.js';
import {
  bearer,
  createStaff,
  login,
  resetDatabase,
  type Tokens,
} from './support/fixtures.js';

/**
 * Prueba integral: el ciclo completo del negocio solo a través de la API, con
 * cada rol haciendo su parte. Comprueba al final que inventario, ventas,
 * ingresos, comprobante, auditoría y correos cuentan la misma historia.
 */
describe('Ciclo completo del negocio (e2e integral)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let mail: RecordingMailService;
  const http = () => request(app.getHttpServer());
  const today = () => todayInBusinessZone();

  beforeAll(async () => {
    ({ app, prisma, mail } = await createTestApp());
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('compra a proveedor → venta en línea → entrega y cobro → devolución → reembolso', async () => {
    const role = async (code: string) =>
      login(app, 'admin', (await createStaff(prisma, [code])).email);
    const [admin, pharmacist, warehouse, finance, sales] = [
      await role('ADMIN'),
      await role('PHARMACIST'),
      await role('WAREHOUSE'),
      await role('FINANCE'),
      await role('SALES'),
    ];
    const as = (tokens: Tokens) => ({
      get: (url: string) => http().get(`/api/v1${url}`).set(bearer(tokens)),
      post: (url: string, body: object = {}) =>
        http().post(`/api/v1${url}`).set(bearer(tokens)).send(body),
      put: (url: string, body: object = {}) =>
        http().put(`/api/v1${url}`).set(bearer(tokens)).send(body),
      patch: (url: string, body: object = {}) =>
        http().patch(`/api/v1${url}`).set(bearer(tokens)).send(body),
    });

    // ── 1. Configuración y catálogo ─────────────────────────────────────────
    await as(admin)
      .patch('/admin/settings/store', {
        staffAlertEmail: 'alertas@farmacia.gt',
      })
      .expect(200);
    const category = (
      await as(admin)
        .post('/admin/categories', { name: 'Cuidado de la piel' })
        .expect(201)
    ).body;
    const product = (
      await as(admin)
        .post('/admin/products', {
          sku: 'PROT-50',
          name: 'Protector solar FPS 50',
          categoryId: category.id,
          price: '80.00',
          saleCondition: 'OTC',
        })
        .expect(201)
    ).body;
    // Solo el regente habilita la venta en línea.
    await as(admin)
      .put(`/admin/products/${product.id}/online-sale`, { enabled: true })
      .expect(403);
    await as(pharmacist)
      .put(`/admin/products/${product.id}/online-sale`, { enabled: true })
      .expect(200);
    const shipping = (
      await as(admin)
        .post('/admin/shipping-methods', {
          name: 'Capital',
          cost: '20.00',
          allowsCashOnDelivery: true,
        })
        .expect(201)
    ).body;
    const courier = (
      await as(admin)
        .post('/admin/couriers', {
          name: 'Cargo Expreso',
          trackingUrlTemplate: 'https://rastreo.example/{tracking}',
        })
        .expect(201)
    ).body;

    // ── 2. Compra al proveedor y recepción en dos lotes ─────────────────────
    const supplier = (
      await as(warehouse)
        .post('/admin/suppliers', {
          name: 'Distribuidora Central',
          taxId: '1234567-K',
        })
        .expect(201)
    ).body;
    const po = (
      await as(warehouse)
        .post('/admin/purchase-orders', {
          supplierId: supplier.id,
          items: [{ productId: product.id, quantity: 12, unitCost: '40.00' }],
        })
        .expect(201)
    ).body;
    await as(warehouse)
      .post(`/admin/purchase-orders/${po.id}/approve`)
      .expect(403);
    await as(finance)
      .post(`/admin/purchase-orders/${po.id}/approve`)
      .expect(200);
    await as(warehouse)
      .post(`/admin/purchase-orders/${po.id}/receipts`, {
        items: [
          {
            purchaseOrderItemId: po.items[0].id,
            lotNumber: 'L-PRONTO',
            expirationDate: addDays(today(), 60),
            quantity: 2,
          },
          {
            purchaseOrderItemId: po.items[0].id,
            lotNumber: 'L-LEJANO',
            expirationDate: addDays(today(), 400),
            quantity: 10,
          },
        ],
      })
      .expect(201);

    // ── 3. Registro de la cliente, verificación y compra contra entrega ─────
    const email = 'lucia.integral@prueba.gt';
    await http()
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'clave-integral-2026',
        firstName: 'Lucía',
        lastName: 'Pérez',
      })
      .expect(201);
    await http()
      .post('/api/v1/auth/verify-email')
      .send({ token: mail.tokenFor(email) })
      .expect(200);
    const customer = await login(app, 'store', email, 'clave-integral-2026');
    const address = (
      await as(customer)
        .post('/store/addresses', {
          label: 'Casa',
          recipientName: 'Lucía Pérez',
          phone: '5555-1234',
          addressLine1: '6a avenida 10-20',
          zone: '10',
          municipality: 'Guatemala',
          department: 'Guatemala',
        })
        .expect(201)
    ).body;
    const storeProduct = (
      await http().get(`/api/v1/store/products/${product.slug}`).expect(200)
    ).body;
    expect(storeProduct).toMatchObject({
      price: '80.00',
      availability: 'AVAILABLE',
    });

    await as(customer)
      .post('/store/cart/items', { productId: product.id, quantity: 3 })
      .expect(200);
    const cart = (
      await as(customer)
        .get(`/store/cart?shippingMethodId=${shipping.id}`)
        .expect(200)
    ).body;
    expect(cart.summary.total).toBe('260.00');
    const order = (
      await as(customer)
        .post('/store/orders', {
          addressId: address.id,
          shippingMethodId: shipping.id,
          paymentMethod: 'CASH_ON_DELIVERY',
          expectedTotal: cart.summary.total,
        })
        .set('Idempotency-Key', randomUUID())
        .expect(201)
    ).body;

    // ── 4. Confirmación, preparación, despacho FEFO y entrega con cobro ─────
    await as(sales).post(`/admin/orders/${order.id}/confirm`).expect(200);
    await as(warehouse).post(`/admin/orders/${order.id}/prepare`).expect(200);
    await as(warehouse)
      .post(`/admin/orders/${order.id}/dispatch`, {
        courierId: courier.id,
        trackingNumber: 'G-777',
        courierCost: '15.00',
      })
      .expect(200);
    const lots = await prisma.lot.findMany({
      where: { productId: product.id },
      orderBy: { expirationDate: 'asc' },
    });
    // FEFO: primero se agota el lote que vence antes.
    expect(lots.map((l) => [l.lotNumber, l.qtyOnHand, l.qtyReserved])).toEqual([
      ['L-PRONTO', 0, 0],
      ['L-LEJANO', 9, 0],
    ]);
    await as(warehouse)
      .post(`/admin/orders/${order.id}/deliver`, { collectedAmount: '260.00' })
      .expect(409); // Bodega no registra cobros
    await as(sales)
      .post(`/admin/orders/${order.id}/deliver`, {
        collectedAmount: '260.00',
        receivedByName: 'Lucía Pérez',
      })
      .expect(200);

    // Comprobante interno emitido al cobrar.
    const receipt = (
      await as(customer).get(`/store/orders/${order.id}/receipt`).expect(200)
    ).body;
    expect(receipt).toMatchObject({ number: 1, total: '260.00' });

    // ── 5. Devolución de 1 unidad, inspección y reembolso ───────────────────
    const detail = (
      await as(sales).get(`/admin/orders/${order.id}`).expect(200)
    ).body;
    const ret = (
      await as(sales)
        .post(`/admin/orders/${order.id}/returns`, {
          reason: 'Empaque dañado',
          items: [{ orderItemId: detail.items[0].id, quantity: 1 }],
        })
        .expect(201)
    ).body;
    await as(sales).post(`/admin/returns/${ret.id}/approve`).expect(200);
    const received = (
      await as(warehouse).post(`/admin/returns/${ret.id}/receive`).expect(200)
    ).body;
    // La unidad devuelta no vuelve sola al inventario.
    expect(
      (await prisma.lot.findMany({ where: { productId: product.id } })).reduce(
        (sum, l) => sum + l.qtyOnHand,
        0,
      ),
    ).toBe(9);
    await as(pharmacist)
      .post(`/admin/returns/${ret.id}/items/${received.items[0].id}/inspect`, {
        disposition: 'RESTOCK',
        conditionNotes: 'Sellado',
      })
      .expect(200);
    const payment = await prisma.payment.findFirstOrThrow({
      where: { orderId: order.id, status: 'APPROVED' },
    });
    const refund = (
      await as(finance)
        .post(`/admin/payments/${payment.id}/refunds`, {
          amount: '80.00',
          method: 'CASH',
          reason: 'Devolución de 1 unidad',
          returnId: ret.id,
        })
        .expect(201)
    ).body;
    await as(finance)
      .post(`/admin/refunds/${refund.id}/complete`, { reference: 'CAJA-1' })
      .expect(200);

    // ── 6. Todo cuenta la misma historia ────────────────────────────────────
    // Kardex: el saldo de cada lote es la suma de sus movimientos.
    const ledger = await prisma.$queryRaw<Array<{ lot: string; diff: number }>>`
      SELECT l.lot_number AS lot, (l.qty_on_hand - COALESCE(sum(m.quantity), 0))::int AS diff
      FROM lots l LEFT JOIN inventory_movements m ON m.lot_id = l.id
      WHERE l.product_id = ${product.id}::uuid GROUP BY l.id`;
    expect(ledger.every((r) => r.diff === 0)).toBe(true);
    const movements = await prisma.inventoryMovement.findMany({
      orderBy: { number: 'asc' },
      select: {
        type: true,
        quantity: true,
        lot: { select: { lotNumber: true } },
      },
    });
    expect(movements.map((m) => [m.type, m.lot.lotNumber, m.quantity])).toEqual(
      [
        ['PURCHASE_RECEIPT', 'L-PRONTO', 2],
        ['PURCHASE_RECEIPT', 'L-LEJANO', 10],
        ['SALE', 'L-PRONTO', -2],
        ['SALE', 'L-LEJANO', -1],
        ['RETURN_RESTOCK', expect.any(String), 1],
      ],
    );

    const range = `from=${today()}&to=${today()}`;
    const salesReport = (
      await as(admin).get(`/admin/reports/sales?${range}`).expect(200)
    ).body;
    expect(salesReport.totals).toMatchObject({
      orders: 1,
      units: 3,
      total: '260.00',
    });
    const income = (
      await as(finance).get(`/admin/billing/income?${range}`).expect(200)
    ).body;
    expect(income).toMatchObject({
      received: '260.00',
      refunded: '80.00',
      net: '180.00',
    });
    const valuation = (
      await as(admin).get('/admin/reports/inventory-valuation').expect(200)
    ).body;
    expect(valuation).toMatchObject({ totalUnits: 10, totalValue: '400.00' });

    // Auditoría: cada rol quedó registrado en su operación.
    const audit = await prisma.auditLog.findMany({
      where: { module: { not: 'auth' } },
      include: {
        user: {
          select: { roles: { select: { role: { select: { code: true } } } } },
        },
      },
      orderBy: { id: 'asc' },
    });
    const byAction = (action: string, module: string) =>
      audit.find((a) => a.action === action && a.module === module)?.user
        ?.roles[0]?.role.code;
    expect(byAction('setOnlineSale', 'products')).toBe('PHARMACIST');
    expect(byAction('approve', 'purchase-orders')).toBe('FINANCE');
    expect(byAction('receive', 'purchase-orders')).toBe('WAREHOUSE');
    expect(byAction('deliver', 'orders')).toBe('SALES');
    expect(byAction('inspect', 'returns')).toBe('PHARMACIST');
    expect(byAction('completeRefund', 'refunds')).toBe('FINANCE');

    // Correos a la cliente, en orden, desde la bandeja de salida.
    await app.get(NotificationDispatcherService).dispatchDue();
    expect(
      mail.messages.filter((m) => m.to === email).map((m) => m.subject),
    ).toEqual([
      'Confirme su correo electrónico',
      'Recibimos su pedido PED-000001',
      'Su pedido PED-000001 fue confirmado',
      'Su pedido PED-000001 va en camino',
      'Su pedido PED-000001 fue entregado',
    ]);
  });
});
