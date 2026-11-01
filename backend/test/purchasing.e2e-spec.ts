import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { addDays, todayInBusinessZone } from '../src/common/utils/dates.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './support/create-app.js';
import {
  bearer,
  createStaff,
  login,
  resetDatabase,
  type Tokens,
} from './support/fixtures.js';

describe('Compras y recepciones (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Tokens;
  let supplierId: string;
  let medicineId: string;
  let otherId: string;
  const http = () => request(app.getHttpServer());
  const future = (days = 365) => addDays(todayInBusinessZone(), days);

  const createOrder = async (items: object[]) =>
    (
      await http()
        .post('/api/v1/admin/purchase-orders')
        .set(bearer(admin))
        .send({ supplierId, items })
        .expect(201)
    ).body;

  const approve = (id: string) =>
    http()
      .post(`/api/v1/admin/purchase-orders/${id}/approve`)
      .set(bearer(admin))
      .expect(200);

  const receive = (id: string, items: object[], tokens = admin) =>
    http()
      .post(`/api/v1/admin/purchase-orders/${id}/receipts`)
      .set(bearer(tokens))
      .send({ items });

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    admin = await login(
      app,
      'admin',
      (await createStaff(prisma, ['ADMIN'])).email,
    );
    const iva = await prisma.taxRate.findFirstOrThrow({
      where: { code: 'IVA' },
    });
    const exempt = await prisma.taxRate.findFirstOrThrow({
      where: { code: 'EXENTO' },
    });
    const category = await prisma.category.create({
      data: { name: 'Medicamentos', slug: 'med' },
    });
    const ingredient = await prisma.activeIngredient.create({
      data: { name: 'Loratadina', slug: 'loratadina' },
    });
    medicineId = (
      await prisma.product.create({
        data: {
          sku: 'LOR-10',
          name: 'Loratadina 10 mg',
          slug: 'lor-10',
          price: '40.00',
          categoryId: category.id,
          taxRateId: iva.id,
          activeIngredients: { create: { activeIngredientId: ingredient.id } },
        },
      })
    ).id;
    otherId = (
      await prisma.product.create({
        data: {
          sku: 'GAS-1',
          name: 'Gasa estéril',
          slug: 'gas-1',
          price: '5.00',
          categoryId: category.id,
          taxRateId: exempt.id,
        },
      })
    ).id;
    supplierId = (
      await http()
        .post('/api/v1/admin/suppliers')
        .set(bearer(admin))
        .send({
          name: 'Distribuidora Central',
          taxId: '1234567-K',
          phone: '2222-3333',
        })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('calcula subtotales e impuestos por línea y solo edita borradores', async () => {
    const order = await createOrder([
      { productId: medicineId, quantity: 10, unitCost: '10.005' },
      { productId: otherId, quantity: 3, unitCost: '2.5' },
    ]);
    expect(order).toMatchObject({
      status: 'DRAFT',
      subtotal: '107.55',
      taxTotal: '12.01',
      total: '119.56',
    });
    const line = order.items.find(
      (i: { product: { id: string } }) => i.product.id === medicineId,
    );
    expect(line).toMatchObject({
      lineSubtotal: '100.05',
      lineTax: '12.01',
      taxRate: '0.1200',
    });

    const updated = await http()
      .put(`/api/v1/admin/purchase-orders/${order.id}`)
      .set(bearer(admin))
      .send({
        supplierId,
        items: [{ productId: medicineId, quantity: 5, unitCost: '10' }],
      })
      .expect(200);
    expect(updated.body).toMatchObject({
      subtotal: '50.00',
      taxTotal: '6.00',
      total: '56.00',
    });

    await approve(order.id);
    await http()
      .put(`/api/v1/admin/purchase-orders/${order.id}`)
      .set(bearer(admin))
      .send({
        supplierId,
        items: [{ productId: medicineId, quantity: 1, unitCost: '1' }],
      })
      .expect(409);
  });

  it('rechaza productos repetidos y órdenes vacías', async () => {
    await http()
      .post('/api/v1/admin/purchase-orders')
      .set(bearer(admin))
      .send({
        supplierId,
        items: [
          { productId: medicineId, quantity: 1, unitCost: '1' },
          { productId: medicineId, quantity: 2, unitCost: '1' },
        ],
      })
      .expect(400);
    await http()
      .post('/api/v1/admin/purchase-orders')
      .set(bearer(admin))
      .send({ supplierId, items: [] })
      .expect(400);
  });

  it('recepción parcial en varios lotes, luego total; genera entradas con costo', async () => {
    const order = await createOrder([
      { productId: medicineId, quantity: 30, unitCost: '10' },
    ]);
    await receive(order.id, [
      {
        purchaseOrderItemId: order.items[0].id,
        lotNumber: 'A',
        expirationDate: future(),
        quantity: 5,
      },
    ]).expect(409); // aún en borrador
    await approve(order.id);
    const itemId = order.items[0].id;

    const partial = await receive(order.id, [
      {
        purchaseOrderItemId: itemId,
        lotNumber: 'A',
        expirationDate: future(300),
        quantity: 10,
      },
      {
        purchaseOrderItemId: itemId,
        lotNumber: 'B',
        expirationDate: future(400),
        quantity: 5,
        unitCost: '11',
      },
    ]).expect(201);
    expect(partial.body).toMatchObject({ status: 'PARTIALLY_RECEIVED' });
    expect(partial.body.items[0]).toMatchObject({
      quantityReceived: 15,
      quantityPending: 15,
    });

    const done = await receive(order.id, [
      {
        purchaseOrderItemId: itemId,
        lotNumber: 'A',
        expirationDate: future(300),
        quantity: 15,
        unitCost: '12',
      },
    ]).expect(201);
    expect(done.body.status).toBe('RECEIVED');
    expect(done.body.receipts).toHaveLength(2);

    const lotA = await prisma.lot.findFirstOrThrow({
      where: { lotNumber: 'A' },
    });
    // Promedio ponderado: (10 × 10 + 15 × 12) / 25 = 11.2
    expect(lotA.qtyOnHand).toBe(25);
    expect(lotA.avgUnitCost.toFixed(4)).toBe('11.2000');
    const movements = await prisma.inventoryMovement.count({
      where: { type: 'PURCHASE_RECEIPT' },
    });
    expect(movements).toBe(3);

    await receive(order.id, [
      {
        purchaseOrderItemId: itemId,
        lotNumber: 'C',
        expirationDate: future(),
        quantity: 1,
      },
    ]).expect(409);
  });

  it('una recepción inválida no deja nada registrado (transacción)', async () => {
    const order = await createOrder([
      { productId: medicineId, quantity: 10, unitCost: '10' },
      { productId: otherId, quantity: 5, unitCost: '1' },
    ]);
    await approve(order.id);
    const [med, other] = [medicineId, otherId].map(
      (id) =>
        order.items.find(
          (i: { product: { id: string } }) => i.product.id === id,
        ).id,
    );

    // La segunda línea excede lo pendiente: se revierte también la primera.
    await receive(order.id, [
      {
        purchaseOrderItemId: med,
        lotNumber: 'OK',
        expirationDate: future(),
        quantity: 10,
      },
      { purchaseOrderItemId: other, lotNumber: 'G1', quantity: 6 },
    ]).expect(400);
    // Medicamento sin vencimiento.
    await receive(order.id, [
      { purchaseOrderItemId: med, lotNumber: 'OK', quantity: 1 },
    ]).expect(400);

    expect(await prisma.lot.count()).toBe(0);
    expect(await prisma.inventoryMovement.count()).toBe(0);
    expect(await prisma.purchaseReceipt.count()).toBe(0);
    const fresh = await http()
      .get(`/api/v1/admin/purchase-orders/${order.id}`)
      .set(bearer(admin));
    expect(fresh.body.status).toBe('APPROVED');
  });

  it('un lote existente debe coincidir en vencimiento y estado', async () => {
    const order = await createOrder([
      { productId: medicineId, quantity: 20, unitCost: '10' },
    ]);
    await approve(order.id);
    const itemId = order.items[0].id;
    await receive(order.id, [
      {
        purchaseOrderItemId: itemId,
        lotNumber: 'X',
        expirationDate: future(200),
        quantity: 5,
      },
    ]).expect(201);
    await receive(order.id, [
      {
        purchaseOrderItemId: itemId,
        lotNumber: 'X',
        expirationDate: future(201),
        quantity: 5,
      },
    ]).expect(400);
    await receive(order.id, [
      {
        purchaseOrderItemId: itemId,
        lotNumber: 'X',
        expirationDate: future(200),
        quantity: 5,
        initialStatus: 'QUARANTINE',
      },
    ]).expect(400);
  });

  it('recibe en cuarentena y no queda disponible', async () => {
    const order = await createOrder([
      { productId: otherId, quantity: 5, unitCost: '1' },
    ]);
    await approve(order.id);
    await receive(order.id, [
      {
        purchaseOrderItemId: order.items[0].id,
        lotNumber: 'Q',
        quantity: 5,
        initialStatus: 'QUARANTINE',
      },
    ]).expect(201);
    const lot = await prisma.lot.findFirstOrThrow({
      where: { lotNumber: 'Q' },
    });
    expect(lot.status).toBe('QUARANTINE');
  });

  it('cancelar solo sin recepciones; cerrar solo con recepción parcial', async () => {
    const order = await createOrder([
      { productId: otherId, quantity: 10, unitCost: '1' },
    ]);
    await approve(order.id);
    await http()
      .post(`/api/v1/admin/purchase-orders/${order.id}/close`)
      .set(bearer(admin))
      .expect(409);
    await receive(order.id, [
      { purchaseOrderItemId: order.items[0].id, lotNumber: 'P', quantity: 4 },
    ]).expect(201);
    await http()
      .post(`/api/v1/admin/purchase-orders/${order.id}/cancel`)
      .set(bearer(admin))
      .expect(409);
    const closed = await http()
      .post(`/api/v1/admin/purchase-orders/${order.id}/close`)
      .set(bearer(admin))
      .expect(200);
    expect(closed.body.status).toBe('CLOSED');

    const draft = await createOrder([
      { productId: otherId, quantity: 1, unitCost: '1' },
    ]);
    const cancelled = await http()
      .post(`/api/v1/admin/purchase-orders/${draft.id}/cancel`)
      .set(bearer(admin))
      .expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');
  });

  it('Bodega recibe pero no aprueba; Finanzas aprueba pero no recibe', async () => {
    const order = await createOrder([
      { productId: otherId, quantity: 2, unitCost: '1' },
    ]);
    const warehouse = await login(
      app,
      'admin',
      (await createStaff(prisma, ['WAREHOUSE'])).email,
    );
    const finance = await login(
      app,
      'admin',
      (await createStaff(prisma, ['FINANCE'])).email,
    );
    await http()
      .post(`/api/v1/admin/purchase-orders/${order.id}/approve`)
      .set(bearer(warehouse))
      .expect(403);
    await http()
      .post(`/api/v1/admin/purchase-orders/${order.id}/approve`)
      .set(bearer(finance))
      .expect(200);
    const line = [
      { purchaseOrderItemId: order.items[0].id, lotNumber: 'W', quantity: 2 },
    ];
    await receive(order.id, line, finance).expect(403);
    await receive(order.id, line, warehouse).expect(201);
  });

  it('proveedores: no se dan de baja con órdenes abiertas', async () => {
    await createOrder([{ productId: otherId, quantity: 1, unitCost: '1' }]);
    await http()
      .delete(`/api/v1/admin/suppliers/${supplierId}`)
      .set(bearer(admin))
      .expect(409);
    const list = await http()
      .get('/api/v1/admin/suppliers?search=central')
      .set(bearer(admin))
      .expect(200);
    expect(list.body.items[0]).toMatchObject({
      taxId: '1234567K',
      purchaseOrderCount: 1,
    });
  });
});
