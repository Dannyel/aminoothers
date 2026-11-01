import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './support/create-app.js';
import {
  bearer,
  createSellableProduct,
  createShippingMethod,
  createStaff,
  createStaffWithPermissions,
  login,
  resetDatabase,
  type Tokens,
} from './support/fixtures.js';

describe('Tienda: catálogo y configuración (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Tokens;
  const http = () => request(app.getHttpServer());

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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('catálogo público', () => {
    it('muestra solo productos visibles con su disponibilidad vendible', async () => {
      const brand = await prisma.brand.create({
        data: { name: 'Marca Sol', slug: 'marca-sol' },
      });
      const sellable = await createSellableProduct(prisma, {
        name: 'Bloqueador solar',
        price: '95.50',
        overrides: { brandId: brand.id },
        // Solo cuentan los 3 del lote vigente: cuarentena y vida útil corta no.
        lots: [
          { qty: 3, expiresInDays: 400 },
          { qty: 50, status: 'QUARANTINE' },
          { qty: 50, expiresInDays: 15 },
        ],
      });
      const prescription = await createSellableProduct(prisma, {
        name: 'Amoxicilina 500 mg',
        overrides: { saleCondition: 'PRESCRIPTION', onlineSaleEnabled: false },
      });
      const outOfStock = await createSellableProduct(prisma, {
        name: 'Cepillo dental',
        lots: [],
      });
      await createSellableProduct(prisma, {
        name: 'Producto inactivo',
        overrides: { isActive: false, onlineSaleEnabled: false },
      });

      const res = await http().get('/api/v1/store/products').expect(200);
      expect(res.body.total).toBe(3);
      const byId = new Map(
        res.body.items.map((p: { id: string }) => [p.id, p]),
      );
      expect(byId.get(sellable.id)).toMatchObject({
        price: '95.50',
        availability: 'LOW_STOCK',
        maxQuantity: 3,
        brand: { slug: 'marca-sol' },
      });
      expect(byId.get(prescription.id)).toMatchObject({
        availability: 'PHARMACY_ONLY',
        maxQuantity: 0,
      });
      expect(byId.get(outOfStock.id)).toMatchObject({
        availability: 'OUT_OF_STOCK',
        maxQuantity: 0,
      });
      expect(res.body.brands).toEqual([
        { id: brand.id, name: 'Marca Sol', slug: 'marca-sol' },
      ]);

      const detail = await http()
        .get(`/api/v1/store/products/${sellable.slug}`)
        .expect(200);
      expect(detail.body).toMatchObject({
        name: 'Bloqueador solar',
        category: { slug: 'cuidado-personal' },
        activeIngredients: [],
        images: [],
      });
      await http()
        .get('/api/v1/store/products/producto-inexistente')
        .expect(404);
    });

    it('filtra por categoría, subcategoría, marca y búsqueda, y ordena por precio', async () => {
      const category = await prisma.category.create({
        data: { name: 'Vitaminas', slug: 'vitaminas' },
      });
      const sub = await prisma.subcategory.create({
        data: { categoryId: category.id, name: 'Niños', slug: 'ninos' },
      });
      const brand = await prisma.brand.create({
        data: { name: 'Vitalab', slug: 'vitalab' },
      });
      await createSellableProduct(prisma, {
        name: 'Vitamina C',
        price: '40.00',
        categoryId: category.id,
        overrides: { subcategoryId: sub.id, brandId: brand.id },
      });
      await createSellableProduct(prisma, {
        name: 'Multivitamínico',
        price: '20.00',
        categoryId: category.id,
      });
      await createSellableProduct(prisma, { name: 'Jabón neutro' });

      const inCategory = await http()
        .get('/api/v1/store/products?category=vitaminas&sort=price_asc')
        .expect(200);
      expect(
        inCategory.body.items.map((p: { name: string }) => p.name),
      ).toEqual(['Multivitamínico', 'Vitamina C']);
      const inSub = await http()
        .get('/api/v1/store/products?category=vitaminas&subcategory=ninos')
        .expect(200);
      expect(inSub.body.total).toBe(1);
      const byBrand = await http()
        .get('/api/v1/store/products?brand=vitalab')
        .expect(200);
      expect(byBrand.body.total).toBe(1);
      const search = await http()
        .get('/api/v1/store/products?search=multivitaminico')
        .expect(200);
      expect(search.body.items[0].name).toBe('Multivitamínico');
      const unknown = await http()
        .get('/api/v1/store/products?category=no-existe')
        .expect(200);
      expect(unknown.body.total).toBe(0);

      const categories = await http()
        .get('/api/v1/store/categories')
        .expect(200);
      expect(
        categories.body.find((c: { slug: string }) => c.slug === 'vitaminas'),
      ).toMatchObject({
        productCount: 2,
        subcategories: [{ slug: 'ninos', name: 'Niños' }],
      });
    });

    it('oculta los productos de categorías inactivas', async () => {
      const category = await prisma.category.create({
        data: { name: 'Oculta', slug: 'oculta', isActive: false },
      });
      const product = await createSellableProduct(prisma, {
        categoryId: category.id,
      });
      await http().get(`/api/v1/store/products/${product.slug}`).expect(404);
      const res = await http().get('/api/v1/store/products').expect(200);
      expect(res.body.total).toBe(0);
    });
  });

  describe('configuración', () => {
    it('la información de la farmacia es pública y solo se edita con settings.manage', async () => {
      const info = await http().get('/api/v1/store/info').expect(200);
      expect(info.body).toMatchObject({
        tradeName: 'Farmacia en línea',
        regulatoryNotice: expect.stringContaining('profesional de la salud'),
      });

      const updated = await http()
        .patch('/api/v1/admin/settings/store')
        .set(bearer(admin))
        .send({
          tradeName: 'Farmacia San Juan',
          taxId: '1234567-K'.replace('-', ''),
          email: 'contacto@farmacia.gt',
          regentName: 'Lic. Ana Pérez',
          phone: '',
          transferReservationHours: 12,
        })
        .expect(200);
      expect(updated.body).toMatchObject({
        tradeName: 'Farmacia San Juan',
        taxId: '1234567K',
        phone: null,
        transferReservationHours: 12,
        codReservationHours: 48,
      });
      await http()
        .patch('/api/v1/admin/settings/store')
        .set(bearer(admin))
        .send({ transferReservationHours: 0, email: 'no-es-correo' })
        .expect(400);

      const warehouse = await login(
        app,
        'admin',
        (await createStaff(prisma, ['WAREHOUSE'])).email,
      );
      await http()
        .get('/api/v1/admin/settings/store')
        .set(bearer(warehouse))
        .expect(403);
      const allowed = await login(
        app,
        'admin',
        (await createStaffWithPermissions(prisma, ['settings.manage'])).email,
      );
      await http()
        .get('/api/v1/admin/settings/store')
        .set(bearer(allowed))
        .expect(200);
    });

    it('carga y reemplaza el logotipo validando el contenido', async () => {
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      );
      await http()
        .put('/api/v1/admin/settings/store/logo')
        .set(bearer(admin))
        .attach('file', Buffer.from('no es imagen'), 'logo.png')
        .expect(400);
      const first = await http()
        .put('/api/v1/admin/settings/store/logo')
        .set(bearer(admin))
        .attach('file', png, 'logo.png')
        .expect(200);
      const second = await http()
        .put('/api/v1/admin/settings/store/logo')
        .set(bearer(admin))
        .attach('file', png, 'logo.png')
        .expect(200);
      expect(second.body.logoFileId).not.toBe(first.body.logoFileId);
      expect(await prisma.file.count({ where: { purpose: 'LOGO' } })).toBe(1);
      await http().get(`/api/v1/files/${second.body.logoFileId}`).expect(200);

      const removed = await http()
        .delete('/api/v1/admin/settings/store/logo')
        .set(bearer(admin))
        .expect(200);
      expect(removed.body.logoFileId).toBeNull();
      expect(await prisma.file.count({ where: { purpose: 'LOGO' } })).toBe(0);
    });

    it('administra métodos de envío; la tienda ve solo los activos', async () => {
      const created = await http()
        .post('/api/v1/admin/shipping-methods')
        .set(bearer(admin))
        .send({
          name: 'Capital',
          cost: '25.00',
          estimatedDaysMin: 1,
          estimatedDaysMax: 2,
        })
        .expect(201);
      expect(created.body).toMatchObject({
        cost: '25.00',
        allowsCashOnDelivery: true,
        isActive: true,
      });
      await http()
        .post('/api/v1/admin/shipping-methods')
        .set(bearer(admin))
        .send({ name: 'Mal', cost: '-1' })
        .expect(400);
      await http()
        .post('/api/v1/admin/shipping-methods')
        .set(bearer(admin))
        .send({
          name: 'Mal',
          cost: '10',
          estimatedDaysMin: 5,
          estimatedDaysMax: 2,
        })
        .expect(400);

      const inactive = await createShippingMethod(prisma, {
        name: 'Departamentos',
      });
      await http()
        .patch(`/api/v1/admin/shipping-methods/${inactive.id}`)
        .set(bearer(admin))
        .send({ isActive: false, cost: '0' })
        .expect(200);

      const store = await http()
        .get('/api/v1/store/shipping-methods')
        .expect(200);
      expect(store.body.map((m: { name: string }) => m.name)).toEqual([
        'Capital',
      ]);

      await http()
        .delete(`/api/v1/admin/shipping-methods/${created.body.id}`)
        .set(bearer(admin))
        .expect(204);
      const after = await http()
        .get('/api/v1/admin/shipping-methods')
        .set(bearer(admin))
        .expect(200);
      expect(after.body.map((m: { name: string }) => m.name)).toEqual([
        'Departamentos',
      ]);
    });
  });
});
