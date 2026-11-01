import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { ModulesContainer } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import {
  IS_PUBLIC_KEY,
  PERMISSIONS_KEY,
  USER_TYPE_KEY,
} from '../src/common/decorators/auth.decorators.js';
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

interface Route {
  method: string;
  path: string;
  isPublic: boolean;
  userType: string | undefined;
  permissions: string[];
}

/** Rutas del panel que cualquier usuario del personal puede usar sin permiso específico. */
const STAFF_ROUTES_WITHOUT_PERMISSION = new Set(['GET /admin/dashboard']);

/** Recorre los controladores registrados y lee la metadata de autorización de cada ruta. */
function collectRoutes(app: NestExpressApplication): Route[] {
  const routes: Route[] = [];
  for (const module of app.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      const controller = wrapper.metatype as (new () => object) | null;
      if (!controller) continue;
      const base = String(Reflect.getMetadata(PATH_METADATA, controller) ?? '');
      const proto = controller.prototype as Record<string, unknown>;
      for (const name of Object.getOwnPropertyNames(proto)) {
        const handler = proto[name];
        if (name === 'constructor' || typeof handler !== 'function') continue;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as
          RequestMethod | undefined;
        if (method === undefined) continue;
        const sub = String(Reflect.getMetadata(PATH_METADATA, handler) ?? '');
        const read = <T>(key: string): T | undefined =>
          (Reflect.getMetadata(key, handler) ??
            Reflect.getMetadata(key, controller)) as T | undefined;
        routes.push({
          method: RequestMethod[method],
          path: `/${[base, sub].filter((p) => p && p !== '/').join('/')}`.replace(
            /\/+/g,
            '/',
          ),
          isPublic: read<boolean>(IS_PUBLIC_KEY) ?? false,
          userType: read<string>(USER_TYPE_KEY),
          permissions: read<string[]>(PERMISSIONS_KEY) ?? [],
        });
      }
    }
  }
  return routes;
}

/** Ruta concreta para probarla: los parámetros se reemplazan por ids inexistentes. */
const concrete = (path: string) =>
  `/api/v1${path.replace(/:kind/g, 'marcas').replace(/:[a-zA-Z]+/g, randomUUID())}`;

describe('Seguridad (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let routes: Route[];
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    routes = collectRoutes(app);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('autorización de todas las rutas', () => {
    it('toda ruta del panel exige personal y, salvo excepciones explícitas, un permiso', () => {
      const admin = routes.filter((r) => r.path.startsWith('/admin'));
      expect(admin.length).toBeGreaterThan(100);
      const problems = admin
        .filter(
          (r) =>
            r.isPublic ||
            r.userType !== 'STAFF' ||
            (r.permissions.length === 0 &&
              !STAFF_ROUTES_WITHOUT_PERMISSION.has(`${r.method} ${r.path}`)),
        )
        .map((r) => `${r.method} ${r.path}`);
      expect(problems).toEqual([]);
    });

    it('las rutas de la tienda son públicas o exclusivas de clientes', () => {
      const store = routes.filter((r) => r.path.startsWith('/store'));
      const problems = store
        .filter((r) => !r.isPublic && r.userType !== 'CUSTOMER')
        .map((r) => `${r.method} ${r.path}`);
      expect(problems).toEqual([]);
      // Carrito, pedidos, direcciones y perfil nunca son públicos.
      const leaked = store
        .filter(
          (r) =>
            r.isPublic && /\/(cart|orders|addresses|profile|me)\b/.test(r.path),
        )
        .map((r) => `${r.method} ${r.path}`);
      expect(leaked).toEqual([]);
    });

    it('las rutas públicas son solo las previstas', () => {
      const publicRoutes = routes
        .filter((r) => r.isPublic)
        .map((r) => `${r.method} ${r.path}`)
        .filter((r) => !/ \/(store|health|files)\b/.test(r));
      // Autenticación: las que se usan sin sesión.
      expect(publicRoutes.every((r) => r.includes(' /auth/'))).toBe(true);
    });

    it('sin sesión, con sesión de cliente o sin permisos no se entra al panel', async () => {
      const customerUser = await createCustomer(prisma);
      const customer = await login(app, 'store', customerUser.email);
      const noRoles = await login(
        app,
        'admin',
        (await createStaff(prisma, [])).email,
      );
      const admin = routes.filter((r) => r.path.startsWith('/admin'));
      const send = (r: Route, tokens?: Tokens) => {
        const req = http()[
          r.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete'
        ](concrete(r.path));
        return tokens ? req.set(bearer(tokens)) : req;
      };
      const unexpected: string[] = [];
      for (const r of admin) {
        const anon = await send(r);
        if (anon.status !== 401)
          unexpected.push(`anónimo ${r.method} ${r.path} → ${anon.status}`);
        const asCustomer = await send(r, customer);
        if (asCustomer.status !== 403)
          unexpected.push(
            `cliente ${r.method} ${r.path} → ${asCustomer.status}`,
          );
        if (!STAFF_ROUTES_WITHOUT_PERMISSION.has(`${r.method} ${r.path}`)) {
          const asStaff = await send(r, noRoles);
          if (asStaff.status !== 403)
            unexpected.push(
              `sin permisos ${r.method} ${r.path} → ${asStaff.status}`,
            );
        }
      }
      expect(unexpected).toEqual([]);
    });

    it('el personal no puede usar la tienda como cliente', async () => {
      const staff = await login(
        app,
        'admin',
        (await createStaff(prisma, ['ADMIN'])).email,
      );
      await http().get('/api/v1/store/cart').set(bearer(staff)).expect(403);
      await http().get('/api/v1/store/orders').set(bearer(staff)).expect(403);
    });
  });

  describe('datos de otros clientes y entradas maliciosas', () => {
    it('un cliente no ve ni modifica el pedido de otro', async () => {
      const owner = await createCustomer(prisma);
      const ownerTokens = await login(app, 'store', owner.email);
      const intruder = await login(
        app,
        'store',
        (await createCustomer(prisma)).email,
      );
      const product = await createSellableProduct(prisma, { price: '20.00' });
      const shipping = await createShippingMethod(prisma);
      const address = await createAddress(prisma, owner.id);
      await http()
        .post('/api/v1/store/cart/items')
        .set(bearer(ownerTokens))
        .send({ productId: product.id, quantity: 1 })
        .expect(200);
      const cart = await http()
        .get(`/api/v1/store/cart?shippingMethodId=${shipping.id}`)
        .set(bearer(ownerTokens))
        .expect(200);
      const order = await http()
        .post('/api/v1/store/orders')
        .set(bearer(ownerTokens))
        .set('Idempotency-Key', randomUUID())
        .send({
          addressId: address.id,
          shippingMethodId: shipping.id,
          paymentMethod: 'CASH_ON_DELIVERY',
          expectedTotal: cart.body.summary.total,
        })
        .expect(201);

      await http()
        .get(`/api/v1/store/orders/${order.body.id}`)
        .set(bearer(intruder))
        .expect(404);
      await http()
        .post(`/api/v1/store/orders/${order.body.id}/cancel`)
        .set(bearer(intruder))
        .send({})
        .expect(404);
      await http()
        .get(`/api/v1/store/orders/${order.body.id}/receipt`)
        .set(bearer(intruder))
        .expect(404);
      // Tampoco puede usar la dirección del dueño en su propio pedido.
      await http()
        .post('/api/v1/store/cart/items')
        .set(bearer(intruder))
        .send({ productId: product.id, quantity: 1 })
        .expect(200);
      const res = await http()
        .post('/api/v1/store/orders')
        .set(bearer(intruder))
        .set('Idempotency-Key', randomUUID())
        .send({
          addressId: address.id,
          shippingMethodId: shipping.id,
          paymentMethod: 'CASH_ON_DELIVERY',
          expectedTotal: cart.body.summary.total,
        });
      expect([400, 404]).toContain(res.status);
    });

    it('rechaza campos no declarados (asignación masiva) y el precio enviado por el cliente', async () => {
      const user = await createCustomer(prisma);
      const tokens = await login(app, 'store', user.email);
      const product = await createSellableProduct(prisma, { price: '20.00' });
      await http()
        .post('/api/v1/store/cart/items')
        .set(bearer(tokens))
        .send({ productId: product.id, quantity: 1, price: '0.01' })
        .expect(400);
      await http()
        .patch('/api/v1/store/profile')
        .set(bearer(tokens))
        .send({ firstName: 'Ana', type: 'STAFF' })
        .expect(400);
    });

    it('las búsquedas con caracteres de SQL se tratan como texto', async () => {
      await createSellableProduct(prisma, { name: "Crema O'Neil" });
      const res = await http()
        .get(
          `/api/v1/store/products?search=${encodeURIComponent("O'Neil'; DROP TABLE products; --")}`,
        )
        .expect(200);
      expect(res.body.items).toEqual([]);
      const ok = await http()
        .get(`/api/v1/store/products?search=${encodeURIComponent("O'Neil")}`)
        .expect(200);
      expect(ok.body.items).toHaveLength(1);
      expect(await prisma.product.count()).toBe(1);
    });

    it('un archivo que no es imagen no se acepta aunque diga serlo', async () => {
      const admin = await login(
        app,
        'admin',
        (await createStaff(prisma, ['ADMIN'])).email,
      );
      const product = await createSellableProduct(prisma);
      await http()
        .post(`/api/v1/admin/products/${product.id}/images`)
        .set(bearer(admin))
        .attach('file', Buffer.from('<script>alert(1)</script>'), {
          filename: 'foto.png',
          contentType: 'image/png',
        })
        .expect(400);
    });

    it('la API responde con cabeceras de seguridad y sin delatar la tecnología', async () => {
      const res = await http().get('/api/v1/health').expect(200);
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['strict-transport-security']).toBeDefined();
      expect(res.headers['x-frame-options']).toBeDefined();
    });
  });
});
