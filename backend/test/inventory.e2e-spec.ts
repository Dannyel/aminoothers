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

describe('Inventario por lotes (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Tokens;
  let medicineId: string;
  let otherId: string;
  const http = () => request(app.getHttpServer());
  const today = () => todayInBusinessZone();

  const createLot = (body: object) =>
    http().post('/api/v1/admin/inventory/lots').set(bearer(admin)).send(body);

  const stockOf = async (productId: string) => {
    const res = await http()
      .get('/api/v1/admin/inventory/stock?pageSize=100')
      .set(bearer(admin))
      .expect(200);
    return res.body.items.find(
      (s: { productId: string }) => s.productId === productId,
    );
  };

  /** El saldo de cada lote debe ser exactamente la suma de sus movimientos. */
  const assertLedgerConsistent = async () => {
    const mismatches = await prisma.$queryRaw<unknown[]>`
      SELECT l.id FROM lots l
      LEFT JOIN inventory_movements m ON m.lot_id = l.id
      GROUP BY l.id, l.qty_on_hand
      HAVING l.qty_on_hand <> COALESCE(sum(m.quantity), 0)`;
    expect(mismatches).toEqual([]);
  };

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
    const tax = await prisma.taxRate.findFirstOrThrow({
      where: { code: 'IVA' },
    });
    const category = await prisma.category.create({
      data: { name: 'Medicamentos', slug: 'med' },
    });
    const ingredient = await prisma.activeIngredient.create({
      data: { name: 'Ibuprofeno', slug: 'ibuprofeno' },
    });
    medicineId = (
      await prisma.product.create({
        data: {
          sku: 'IBU-400',
          name: 'Ibuprofeno 400 mg',
          slug: 'ibu-400',
          price: '30.00',
          categoryId: category.id,
          taxRateId: tax.id,
          activeIngredients: { create: { activeIngredientId: ingredient.id } },
        },
      })
    ).id;
    otherId = (
      await prisma.product.create({
        data: {
          sku: 'ALG-1',
          name: 'Algodón',
          slug: 'alg-1',
          price: '8.00',
          categoryId: category.id,
          taxRateId: tax.id,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('lotes y existencias', () => {
    it('crea existencia inicial con su movimiento y calcula los conceptos de existencia', async () => {
      const lot = await createLot({
        productId: medicineId,
        lotNumber: 'L-001',
        expirationDate: addDays(today(), 365),
        quantity: 50,
        unitCost: '12.5',
      }).expect(201);
      expect(lot.body).toMatchObject({
        qtyOnHand: 50,
        qtyAvailable: 50,
        avgUnitCost: '12.5000',
      });

      const movements = await http()
        .get(`/api/v1/admin/inventory/movements?lotId=${lot.body.id}`)
        .set(bearer(admin))
        .expect(200);
      expect(movements.body.items[0]).toMatchObject({
        type: 'ADJUSTMENT_IN',
        quantity: 50,
        balanceAfter: 50,
        reasonCode: 'INITIAL_STOCK',
      });

      expect(await stockOf(medicineId)).toMatchObject({
        physical: 50,
        available: 50,
        expired: 0,
      });
      await assertLedgerConsistent();
    });

    it('exige vencimiento futuro a los medicamentos, no a otros productos', async () => {
      await createLot({
        productId: medicineId,
        lotNumber: 'X',
        quantity: 1,
        unitCost: '1',
      }).expect(400);
      await createLot({
        productId: medicineId,
        lotNumber: 'X',
        expirationDate: addDays(today(), -1),
        quantity: 1,
        unitCost: '1',
      }).expect(400);
      await createLot({
        productId: otherId,
        lotNumber: 'X',
        quantity: 5,
        unitCost: '1',
      }).expect(201);
      // El mismo número de lote no se duplica.
      await createLot({
        productId: otherId,
        lotNumber: 'X',
        quantity: 5,
        unitCost: '1',
      }).expect(409);
    });

    it('lotes por vencer o con poca vida útil no están disponibles; los vencidos se detectan', async () => {
      const soon = await createLot({
        productId: medicineId,
        lotNumber: 'SOON',
        expirationDate: addDays(today(), 10),
        quantity: 5,
        unitCost: '10',
      }).expect(201);
      expect(soon.body).toMatchObject({
        belowShelfLife: true,
        isNearExpiry: true,
        qtyAvailable: 0,
      });

      await createLot({
        productId: medicineId,
        lotNumber: 'OK',
        expirationDate: addDays(today(), 200),
        quantity: 7,
        unitCost: '10',
      }).expect(201);
      expect(await stockOf(medicineId)).toMatchObject({
        physical: 12,
        available: 7,
        nearExpiry: 5,
      });

      // Simula el paso del tiempo: el lote ya venció.
      await prisma.lot.update({
        where: { id: soon.body.id },
        data: { expirationDate: new Date(`${addDays(today(), -1)}T00:00:00Z`) },
      });
      expect(await stockOf(medicineId)).toMatchObject({
        expired: 5,
        available: 7,
      });
      const alerts = await http()
        .get('/api/v1/admin/inventory/alerts')
        .set(bearer(admin))
        .expect(200);
      expect(alerts.body.expiredLots).toBe(1);

      const expiredList = await http()
        .get('/api/v1/admin/inventory/lots?expiry=expired')
        .set(bearer(admin))
        .expect(200);
      expect(
        expiredList.body.items.map((l: { lotNumber: string }) => l.lotNumber),
      ).toEqual(['SOON']);

      // Con una vida útil mínima de 0 días el lote "por vencer" volvería a venderse,
      // pero el vencido nunca.
      await http()
        .put('/api/v1/admin/inventory/settings')
        .set(bearer(admin))
        .send({ minShelfLifeDaysForSale: 0, nearExpiryDays: 90 })
        .expect(200);
      expect(await stockOf(medicineId)).toMatchObject({ available: 7 });
    });

    it('cuarentena y retiro sacan el lote de la venta; liberar lo devuelve', async () => {
      const lot = await createLot({
        productId: otherId,
        lotNumber: 'Q1',
        quantity: 10,
        unitCost: '2',
      }).expect(201);
      await http()
        .patch(`/api/v1/admin/inventory/lots/${lot.body.id}/status`)
        .set(bearer(admin))
        .send({ status: 'QUARANTINE' })
        .expect(400);
      await http()
        .patch(`/api/v1/admin/inventory/lots/${lot.body.id}/status`)
        .set(bearer(admin))
        .send({ status: 'QUARANTINE', reason: 'Empaque dañado en revisión' })
        .expect(200);
      expect(await stockOf(otherId)).toMatchObject({
        physical: 10,
        quarantine: 10,
        available: 0,
      });

      await http()
        .patch(`/api/v1/admin/inventory/lots/${lot.body.id}/status`)
        .set(bearer(admin))
        .send({ status: 'AVAILABLE' })
        .expect(200);
      expect(await stockOf(otherId)).toMatchObject({
        quarantine: 0,
        available: 10,
      });
    });

    it('lotes ingresados en cuarentena no están disponibles', async () => {
      await createLot({
        productId: otherId,
        lotNumber: 'Q2',
        quantity: 4,
        unitCost: '2',
        status: 'QUARANTINE',
      }).expect(201);
      expect(await stockOf(otherId)).toMatchObject({
        quarantine: 4,
        available: 0,
      });
    });
  });

  describe('movimientos', () => {
    it('ajustes y bajas con motivo, nunca existencias negativas', async () => {
      const lot = await createLot({
        productId: otherId,
        lotNumber: 'A1',
        quantity: 10,
        unitCost: '3',
      });
      const id = lot.body.id;

      await http()
        .post(`/api/v1/admin/inventory/lots/${id}/adjustments`)
        .set(bearer(admin))
        .send({
          direction: 'OUT',
          quantity: 11,
          reasonCode: 'LOSS',
          notes: 'Faltante',
        })
        .expect(409);
      await http()
        .post(`/api/v1/admin/inventory/lots/${id}/adjustments`)
        .set(bearer(admin))
        .send({
          direction: 'OUT',
          quantity: 2,
          reasonCode: 'COUNT_CORRECTION',
          notes: 'Conteo físico',
        })
        .expect(201);
      await http()
        .post(`/api/v1/admin/inventory/lots/${id}/adjustments`)
        .set(bearer(admin))
        .send({
          direction: 'IN',
          quantity: 1,
          reasonCode: 'FOUND',
          notes: '   ',
        })
        .expect(400);

      await http()
        .post(`/api/v1/admin/inventory/lots/${id}/outflows`)
        .set(bearer(admin))
        .send({ quantity: 3, reasonCode: 'DAMAGED' })
        .expect(201);
      const returned = await http()
        .post(`/api/v1/admin/inventory/lots/${id}/outflows`)
        .set(bearer(admin))
        .send({ quantity: 1, reasonCode: 'RETURN_TO_SUPPLIER' })
        .expect(201);
      expect(returned.body.qtyOnHand).toBe(4);

      const kardex = await http()
        .get(`/api/v1/admin/inventory/movements?lotId=${id}`)
        .set(bearer(admin))
        .expect(200);
      expect(
        kardex.body.items.map((m: { type: string; quantity: number }) => [
          m.type,
          m.quantity,
        ]),
      ).toEqual([
        ['RETURN_TO_SUPPLIER', -1],
        ['WRITE_OFF', -3],
        ['ADJUSTMENT_OUT', -2],
        ['ADJUSTMENT_IN', 10],
      ]);
      await assertLedgerConsistent();
    });

    it('un ajuste puede referenciar el movimiento que corrige', async () => {
      const lot = await createLot({
        productId: otherId,
        lotNumber: 'C1',
        quantity: 10,
        unitCost: '3',
      });
      const [original] = (
        await http()
          .get(`/api/v1/admin/inventory/movements?lotId=${lot.body.id}`)
          .set(bearer(admin))
      ).body.items;
      await http()
        .post(`/api/v1/admin/inventory/lots/${lot.body.id}/adjustments`)
        .set(bearer(admin))
        .send({
          direction: 'OUT',
          quantity: 1,
          reasonCode: 'ENTRY_ERROR',
          notes: 'Se ingresó una unidad de más',
          correctsMovementNumber: original.number,
        })
        .expect(201);
      const correction = await prisma.inventoryMovement.findFirstOrThrow({
        where: { lotId: lot.body.id, type: 'ADJUSTMENT_OUT' },
      });
      expect(correction).toMatchObject({
        referenceType: 'MOVEMENT',
        referenceId: original.id,
      });
    });

    it('los movimientos no se pueden modificar ni eliminar', async () => {
      await createLot({
        productId: otherId,
        lotNumber: 'I1',
        quantity: 1,
        unitCost: '1',
      });
      await expect(
        prisma.$executeRaw`UPDATE inventory_movements SET quantity = 99`,
      ).rejects.toThrow(/inmutables/);
      await expect(
        prisma.$executeRaw`DELETE FROM inventory_movements`,
      ).rejects.toThrow(/inmutables/);
    });

    it('salidas simultáneas nunca dejan existencia negativa', async () => {
      const lot = await createLot({
        productId: otherId,
        lotNumber: 'P1',
        quantity: 5,
        unitCost: '1',
      });
      const attempts = await Promise.all(
        Array.from({ length: 8 }, () =>
          http()
            .post(`/api/v1/admin/inventory/lots/${lot.body.id}/adjustments`)
            .set(bearer(admin))
            .send({
              direction: 'OUT',
              quantity: 1,
              reasonCode: 'LOSS',
              notes: 'Prueba',
            }),
        ),
      );
      expect(attempts.filter((r) => r.status === 201)).toHaveLength(5);
      expect(attempts.filter((r) => r.status === 409)).toHaveLength(3);
      const final = await prisma.lot.findUniqueOrThrow({
        where: { id: lot.body.id },
      });
      expect(final.qtyOnHand).toBe(0);
      await assertLedgerConsistent();
    });
  });

  describe('permisos', () => {
    it('Ventas consulta pero no ajusta; Bodega ajusta pero no pone cuarentenas', async () => {
      const lot = await createLot({
        productId: otherId,
        lotNumber: 'R1',
        quantity: 5,
        unitCost: '1',
      });
      const sales = await login(
        app,
        'admin',
        (await createStaff(prisma, ['SALES'])).email,
      );
      await http()
        .get('/api/v1/admin/inventory/stock')
        .set(bearer(sales))
        .expect(403);

      const warehouse = await login(
        app,
        'admin',
        (await createStaff(prisma, ['WAREHOUSE'])).email,
      );
      await http()
        .post(`/api/v1/admin/inventory/lots/${lot.body.id}/adjustments`)
        .set(bearer(warehouse))
        .send({
          direction: 'IN',
          quantity: 1,
          reasonCode: 'FOUND',
          notes: 'Hallazgo',
        })
        .expect(201);
      await http()
        .patch(`/api/v1/admin/inventory/lots/${lot.body.id}/status`)
        .set(bearer(warehouse))
        .send({ status: 'RECALLED', reason: 'Alerta sanitaria' })
        .expect(403);

      const pharmacist = await login(
        app,
        'admin',
        (await createStaff(prisma, ['PHARMACIST'])).email,
      );
      await http()
        .patch(`/api/v1/admin/inventory/lots/${lot.body.id}/status`)
        .set(bearer(pharmacist))
        .send({ status: 'RECALLED', reason: 'Alerta sanitaria' })
        .expect(200);
    });
  });
});
