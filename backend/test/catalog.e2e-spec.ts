import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { MAX_IMAGES_PER_PRODUCT } from '../src/modules/catalog/products/products.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './support/create-app.js';
import {
  bearer,
  createStaff,
  createStaffWithPermissions,
  login,
  resetDatabase,
  type Tokens,
} from './support/fixtures.js';

// PNG válido de 1×1 píxel.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

describe('Catálogos y productos (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Tokens;
  let pharmacist: Tokens;
  const http = () => request(app.getHttpServer());

  const createItem = (kind: string, name: string) =>
    http()
      .post(`/api/v1/admin/catalog/${kind}`)
      .set(bearer(admin))
      .send({ name });

  const createCategory = async (name = 'Medicamentos') =>
    (
      await http()
        .post('/api/v1/admin/categories')
        .set(bearer(admin))
        .send({ name })
        .expect(201)
    ).body as { id: string };

  const baseProduct = (categoryId: string, overrides: object = {}) => ({
    sku: `SKU-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Acetaminofén 500 mg',
    categoryId,
    price: '25.50',
    saleCondition: 'OTC',
    ...overrides,
  });

  const createProduct = async (categoryId: string, overrides: object = {}) =>
    (
      await http()
        .post('/api/v1/admin/products')
        .set(bearer(admin))
        .send(baseProduct(categoryId, overrides))
        .expect(201)
    ).body as { id: string; sku: string };

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
    pharmacist = await login(
      app,
      'admin',
      (await createStaff(prisma, ['PHARMACIST'])).email,
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('catálogos simples', () => {
    it('crea, lista, edita y da de baja; evita duplicados sin importar tildes', async () => {
      const brand = await createItem('brands', 'Bayer').expect(201);
      expect(brand.body).toMatchObject({
        name: 'Bayer',
        slug: 'bayer',
        isActive: true,
      });
      await createItem('brands', 'BAYER').expect(409);
      await createItem('active-ingredients', 'Acetaminofén').expect(201);
      await createItem('active-ingredients', 'acetaminofen').expect(409);

      const list = await http()
        .get('/api/v1/admin/catalog/brands?search=bay')
        .set(bearer(admin))
        .expect(200);
      expect(list.body.total).toBe(1);

      await http()
        .patch(`/api/v1/admin/catalog/brands/${brand.body.id}`)
        .set(bearer(admin))
        .send({ isActive: false })
        .expect(200);
      const inactive = await http()
        .get('/api/v1/admin/catalog/brands?status=inactive')
        .set(bearer(admin))
        .expect(200);
      expect(inactive.body.items[0].isActive).toBe(false);

      await http()
        .delete(`/api/v1/admin/catalog/brands/${brand.body.id}`)
        .set(bearer(admin))
        .expect(204);
      // Tras la baja lógica el nombre puede volver a usarse.
      await createItem('brands', 'Bayer').expect(201);
    });

    it('no permite eliminar un elemento usado por productos', async () => {
      const brand = await createItem('brands', 'Genfar').expect(201);
      const category = await createCategory();
      await createProduct(category.id, { brandId: brand.body.id });
      const res = await http()
        .delete(`/api/v1/admin/catalog/brands/${brand.body.id}`)
        .set(bearer(admin))
        .expect(409);
      expect(res.body.message).toMatch(/Desactívelo/);
    });

    it('rechaza catálogos desconocidos y exige permisos', async () => {
      await http()
        .get('/api/v1/admin/catalog/planetas')
        .set(bearer(admin))
        .expect(400);
      const reader = await createStaffWithPermissions(prisma, ['catalog.read']);
      const readerTokens = await login(app, 'admin', reader.email);
      await http()
        .get('/api/v1/admin/catalog/tags')
        .set(bearer(readerTokens))
        .expect(200);
      await http()
        .post('/api/v1/admin/catalog/tags')
        .set(bearer(readerTokens))
        .send({ name: 'Nuevo' })
        .expect(403);
    });
  });

  describe('categorías', () => {
    it('gestiona subcategorías y valida que pertenezcan a la categoría del producto', async () => {
      const meds = await createCategory('Medicamentos');
      const care = await createCategory('Cuidado personal');
      const analgesics = await http()
        .post(`/api/v1/admin/categories/${meds.id}/subcategories`)
        .set(bearer(admin))
        .send({ name: 'Analgésicos' })
        .expect(201);

      const tree = await http()
        .get('/api/v1/admin/categories')
        .set(bearer(admin))
        .expect(200);
      expect(
        tree.body.find((c: { id: string }) => c.id === meds.id).subcategories,
      ).toHaveLength(1);

      await http()
        .post('/api/v1/admin/products')
        .set(bearer(admin))
        .send(baseProduct(care.id, { subcategoryId: analgesics.body.id }))
        .expect(400);
      const product = await createProduct(meds.id, {
        subcategoryId: analgesics.body.id,
      });

      // Cambiar de categoría sin indicar subcategoría la limpia.
      const moved = await http()
        .patch(`/api/v1/admin/products/${product.id}`)
        .set(bearer(admin))
        .send({ categoryId: care.id })
        .expect(200);
      expect(moved.body.subcategory).toBeNull();

      await http()
        .delete(`/api/v1/admin/categories/${care.id}`)
        .set(bearer(admin))
        .expect(409);
    });
  });

  describe('productos', () => {
    it('crea un producto completo con precio decimal y principios activos', async () => {
      const category = await createCategory();
      const ingredient = await createItem(
        'active-ingredients',
        'Amoxicilina',
      ).expect(201);
      const clav = await createItem(
        'active-ingredients',
        'Ácido clavulánico',
      ).expect(201);
      const presentation = await createItem('presentations', 'Caja').expect(
        201,
      );
      const concentration = await createItem(
        'concentrations',
        '875 mg + 125 mg',
      ).expect(201);

      const res = await http()
        .post('/api/v1/admin/products')
        .set(bearer(admin))
        .send(
          baseProduct(category.id, {
            sku: 'AMX-875',
            barcode: '7401234567890',
            name: 'Amoxicilina con ácido clavulánico',
            price: '125.5',
            saleCondition: 'PRESCRIPTION',
            activeIngredientIds: [ingredient.body.id, clav.body.id],
            presentationId: presentation.body.id,
            concentrationId: concentration.body.id,
            sanitaryRegistration: 'PF-12345',
            sanitaryRegistrationExpiresAt: '2030-12-31',
          }),
        )
        .expect(201);
      expect(res.body).toMatchObject({
        sku: 'AMX-875',
        price: '125.50',
        requiresPrescription: true,
        onlineSaleEnabled: false,
        taxRate: { code: 'IVA', rate: '0.1200' },
        sanitaryRegistrationExpiresAt: '2030-12-31',
      });
      expect(
        res.body.activeIngredients.map((a: { name: string }) => a.name),
      ).toEqual(['Amoxicilina', 'Ácido clavulánico']);
    });

    it('valida SKU, código de barras y precio', async () => {
      const category = await createCategory();
      await createProduct(category.id, { sku: 'DUP-1', barcode: '12345678' });
      await http()
        .post('/api/v1/admin/products')
        .set(bearer(admin))
        .send(baseProduct(category.id, { sku: 'DUP-1' }))
        .expect(409);
      await http()
        .post('/api/v1/admin/products')
        .set(bearer(admin))
        .send(baseProduct(category.id, { barcode: '12345678' }))
        .expect(409);
      for (const price of ['0', '-5', '10.999', 'abc']) {
        await http()
          .post('/api/v1/admin/products')
          .set(bearer(admin))
          .send(baseProduct(category.id, { price }))
          .expect((res) => expect([400]).toContain(res.status));
      }
    });

    it('busca sin distinguir tildes por nombre, SKU, código de barras, marca y principio activo', async () => {
      const category = await createCategory();
      const brand = await createItem('brands', 'Laboratorios Ñandú').expect(
        201,
      );
      const ingredient = await createItem(
        'active-ingredients',
        'Ibuprofeno',
      ).expect(201);
      await createProduct(category.id, {
        name: 'Acetaminofén Forte',
        sku: 'ACE-1',
      });
      await createProduct(category.id, {
        name: 'Dolofin',
        sku: 'DOL-9',
        barcode: '987654321',
        brandId: brand.body.id,
        activeIngredientIds: [ingredient.body.id],
      });

      const find = async (search: string) =>
        (
          await http()
            .get(`/api/v1/admin/products?search=${encodeURIComponent(search)}`)
            .set(bearer(admin))
            .expect(200)
        ).body.items.map((p: { sku: string }) => p.sku);

      expect(await find('acetaminofen')).toEqual(['ACE-1']);
      expect(await find('dol-9')).toEqual(['DOL-9']);
      expect(await find('987654321')).toEqual(['DOL-9']);
      expect(await find('nandu')).toEqual(['DOL-9']);
      expect(await find('IBUPROFENO')).toEqual(['DOL-9']);
      expect(await find('100%_')).toEqual([]);
    });

    it('la baja es lógica y libera el código de barras', async () => {
      const category = await createCategory();
      const product = await createProduct(category.id, { barcode: '55555555' });
      await http()
        .delete(`/api/v1/admin/products/${product.id}`)
        .set(bearer(admin))
        .expect(204);
      await http()
        .get(`/api/v1/admin/products/${product.id}`)
        .set(bearer(admin))
        .expect(404);
      expect(await prisma.product.count()).toBe(1);
      await createProduct(category.id, { barcode: '55555555' });
    });
  });

  describe('venta en línea (verificación regulatoria)', () => {
    it('solo el permiso de aprobación la habilita y registra quién lo hizo', async () => {
      const category = await createCategory();
      const product = await createProduct(category.id);

      // ADMIN gestiona productos pero no aprueba la venta en línea.
      await http()
        .put(`/api/v1/admin/products/${product.id}/online-sale`)
        .set(bearer(admin))
        .send({ enabled: true })
        .expect(403);
      const approved = await http()
        .put(`/api/v1/admin/products/${product.id}/online-sale`)
        .set(bearer(pharmacist))
        .send({ enabled: true })
        .expect(200);
      expect(approved.body.onlineSale).toMatchObject({ enabled: true });
      expect(approved.body.onlineSale.approvedBy.name).toBe('Personal Prueba');
    });

    it('no se habilita para productos con receta, controlados o inactivos', async () => {
      const category = await createCategory();
      for (const saleCondition of [
        'PRESCRIPTION',
        'RETAINED_PRESCRIPTION',
        'CONTROLLED',
      ]) {
        const product = await createProduct(category.id, { saleCondition });
        await http()
          .put(`/api/v1/admin/products/${product.id}/online-sale`)
          .set(bearer(pharmacist))
          .send({ enabled: true })
          .expect(400);
      }
      const inactive = await createProduct(category.id, { isActive: false });
      await http()
        .put(`/api/v1/admin/products/${inactive.id}/online-sale`)
        .set(bearer(pharmacist))
        .send({ enabled: true })
        .expect(400);
    });

    it('cambiar a una condición con receta la deshabilita; la BD impide controlados en línea', async () => {
      const category = await createCategory();
      const product = await createProduct(category.id);
      await http()
        .put(`/api/v1/admin/products/${product.id}/online-sale`)
        .set(bearer(pharmacist))
        .send({ enabled: true })
        .expect(200);
      const changed = await http()
        .patch(`/api/v1/admin/products/${product.id}`)
        .set(bearer(admin))
        .send({ saleCondition: 'PRESCRIPTION' })
        .expect(200);
      expect(changed.body.onlineSale).toEqual({
        enabled: false,
        approvedAt: null,
        approvedBy: null,
      });

      await expect(
        prisma.$executeRaw`UPDATE products SET sale_condition = 'CONTROLLED', online_sale_enabled = true,
          online_sale_approved_at = now(), online_sale_approved_by = gen_random_uuid()
          WHERE id = ${product.id}::uuid`,
      ).rejects.toThrow(/products_controlled_not_online_check/);
    });
  });

  describe('imágenes', () => {
    const upload = (
      productId: string,
      content: Buffer,
      filename = 'foto.png',
    ) =>
      http()
        .post(`/api/v1/admin/products/${productId}/images`)
        .set(bearer(admin))
        .attach('file', content, filename);

    it('valida el contenido real, sirve la imagen y mantiene una principal', async () => {
      const category = await createCategory();
      const product = await createProduct(category.id);

      await upload(
        product.id,
        Buffer.from('<svg onload="alert(1)"></svg>'),
        'foto.png',
      ).expect(400);
      await upload(product.id, Buffer.from('%PDF-1.4 ...'), 'foto.png').expect(
        400,
      );

      const first = await upload(product.id, PNG).expect(201);
      const second = await upload(product.id, PNG, 'otra.png').expect(201);
      const [a, b] = second.body.images;
      expect(a.isPrimary).toBe(true);
      expect(b.isPrimary).toBe(false);
      expect(first.body.primaryImageFileId).toBe(a.fileId);

      const served = await http().get(`/api/v1/files/${a.fileId}`).expect(200);
      expect(served.headers['content-type']).toBe('image/png');
      expect(served.headers['cache-control']).toMatch(/immutable/);

      const promoted = await http()
        .patch(`/api/v1/admin/products/${product.id}/images/${b.id}`)
        .set(bearer(admin))
        .send({ isPrimary: true, altText: 'Caja frontal' })
        .expect(200);
      expect(promoted.body.primaryImageFileId).toBe(b.fileId);

      const reordered = await http()
        .put(`/api/v1/admin/products/${product.id}/images/order`)
        .set(bearer(admin))
        .send({ imageIds: [b.id, a.id] })
        .expect(200);
      expect(reordered.body.images.map((i: { id: string }) => i.id)).toEqual([
        b.id,
        a.id,
      ]);

      const afterDelete = await http()
        .delete(`/api/v1/admin/products/${product.id}/images/${b.id}`)
        .set(bearer(admin))
        .expect(200);
      expect(afterDelete.body.images).toHaveLength(1);
      expect(afterDelete.body.images[0].isPrimary).toBe(true);
      await http().get(`/api/v1/files/${b.fileId}`).expect(404);
    });

    it('limita la cantidad de imágenes por producto', async () => {
      const category = await createCategory();
      const product = await createProduct(category.id);
      for (let i = 0; i < MAX_IMAGES_PER_PRODUCT; i++)
        await upload(product.id, PNG).expect(201);
      await upload(product.id, PNG).expect(400);
    });
  });
});
