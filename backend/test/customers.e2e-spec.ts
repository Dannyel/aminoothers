import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { MAX_ADDRESSES_PER_CUSTOMER } from '../src/modules/customers/addresses.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './support/create-app.js';
import {
  bearer,
  createCustomer,
  createStaff,
  createStaffWithPermissions,
  login,
  resetDatabase,
  type Tokens,
} from './support/fixtures.js';

const address = (label: string) => ({
  label,
  recipientName: 'Ana López',
  phone: '5555-1234',
  addressLine1: '6a avenida 10-20',
  zone: '10',
  municipality: 'Guatemala',
  department: 'Guatemala',
});

describe('Clientes, perfil y direcciones (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let customer: Tokens;
  let customerId: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const user = await createCustomer(prisma);
    customerId = user.id;
    customer = await login(app, 'store', user.email);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('perfil', () => {
    it('consulta y actualiza el perfil, normalizando el NIT', async () => {
      const profile = await http()
        .get('/api/v1/store/profile')
        .set(bearer(customer))
        .expect(200);
      expect(profile.body).toMatchObject({ taxId: 'CF', emailVerified: true });

      const updated = await http()
        .patch('/api/v1/store/profile')
        .set(bearer(customer))
        .send({
          phone: '4444-5555',
          taxId: '1234567-k',
          taxName: 'Ana López',
          birthDate: '1990-05-17',
        })
        .expect(200);
      expect(updated.body).toMatchObject({
        phone: '4444-5555',
        taxId: '1234567K',
        birthDate: '1990-05-17',
      });

      await http()
        .patch('/api/v1/store/profile')
        .set(bearer(customer))
        .send({ taxId: 'ABC123' })
        .expect(400);
      // El correo y el tipo no se modifican por esta vía.
      await http()
        .patch('/api/v1/store/profile')
        .set(bearer(customer))
        .send({ email: 'otro@prueba.gt' })
        .expect(400);
    });
  });

  describe('direcciones', () => {
    const create = (body: object) =>
      http().post('/api/v1/store/addresses').set(bearer(customer)).send(body);

    it('la primera es la predeterminada y solo hay una predeterminada', async () => {
      const casa = await create(address('Casa')).expect(201);
      expect(casa.body.isDefault).toBe(true);

      const trabajo = await create({
        ...address('Trabajo'),
        isDefault: true,
      }).expect(201);
      expect(trabajo.body.isDefault).toBe(true);

      let list = await http()
        .get('/api/v1/store/addresses')
        .set(bearer(customer))
        .expect(200);
      expect(
        list.body.map((a: { label: string; isDefault: boolean }) => [
          a.label,
          a.isDefault,
        ]),
      ).toEqual([
        ['Trabajo', true],
        ['Casa', false],
      ]);

      await http()
        .post(`/api/v1/store/addresses/${casa.body.id}/default`)
        .set(bearer(customer))
        .expect(200);
      list = await http()
        .get('/api/v1/store/addresses')
        .set(bearer(customer))
        .expect(200);
      expect(list.body[0]).toMatchObject({ label: 'Casa', isDefault: true });
    });

    it('al eliminar la predeterminada, otra pasa a serlo', async () => {
      const casa = await create(address('Casa')).expect(201);
      await create(address('Trabajo')).expect(201);

      await http()
        .delete(`/api/v1/store/addresses/${casa.body.id}`)
        .set(bearer(customer))
        .expect(204);
      const list = await http()
        .get('/api/v1/store/addresses')
        .set(bearer(customer))
        .expect(200);
      expect(list.body).toHaveLength(1);
      expect(list.body[0]).toMatchObject({ label: 'Trabajo', isDefault: true });

      // Eliminación lógica: el registro se conserva.
      const stored = await prisma.customerAddress.findUniqueOrThrow({
        where: { id: casa.body.id },
      });
      expect(stored.deletedAt).not.toBeNull();
    });

    it('valida el departamento y el límite de direcciones', async () => {
      await create({ ...address('Casa'), department: 'Narnia' }).expect(400);
      for (let i = 0; i < MAX_ADDRESSES_PER_CUSTOMER; i++) {
        await create(address(`Dir ${i}`)).expect(201);
      }
      await create(address('Una más')).expect(400);
    });

    it('un cliente no puede ver ni modificar direcciones de otro', async () => {
      const casa = await create(address('Casa')).expect(201);
      const other = await createCustomer(prisma);
      const otherTokens = await login(app, 'store', other.email);

      await http()
        .patch(`/api/v1/store/addresses/${casa.body.id}`)
        .set(bearer(otherTokens))
        .send({ label: 'Robada' })
        .expect(404);
      await http()
        .delete(`/api/v1/store/addresses/${casa.body.id}`)
        .set(bearer(otherTokens))
        .expect(404);
      const list = await http()
        .get('/api/v1/store/addresses')
        .set(bearer(otherTokens))
        .expect(200);
      expect(list.body).toEqual([]);
    });

    it('los departamentos son públicos', async () => {
      const res = await http().get('/api/v1/store/departments').expect(200);
      expect(res.body).toHaveLength(22);
    });
  });

  describe('administración de clientes', () => {
    it('lista, busca y muestra el detalle con direcciones', async () => {
      await http()
        .post('/api/v1/store/addresses')
        .set(bearer(customer))
        .send(address('Casa'));
      const sales = await createStaff(prisma, ['SALES']);
      const tokens = await login(app, 'admin', sales.email);

      const list = await http()
        .get('/api/v1/admin/customers')
        .set(bearer(tokens))
        .expect(200);
      expect(list.body.total).toBe(1);

      const detail = await http()
        .get(`/api/v1/admin/customers/${customerId}`)
        .set(bearer(tokens))
        .expect(200);
      expect(detail.body.addresses).toHaveLength(1);

      // SALES solo consulta.
      await http()
        .patch(`/api/v1/admin/customers/${customerId}/status`)
        .set(bearer(tokens))
        .send({ status: 'BLOCKED' })
        .expect(403);
    });

    it('bloquear un cliente cierra sus sesiones y le impide entrar', async () => {
      const manager = await createStaffWithPermissions(prisma, [
        'customers.read',
        'customers.manage',
      ]);
      const tokens = await login(app, 'admin', manager.email);

      await http()
        .patch(`/api/v1/admin/customers/${customerId}/status`)
        .set(bearer(tokens))
        .send({ status: 'BLOCKED' })
        .expect(200);
      await http()
        .get('/api/v1/store/profile')
        .set(bearer(customer))
        .expect(401);

      await http()
        .patch(`/api/v1/admin/customers/${customerId}/status`)
        .set(bearer(tokens))
        .send({ status: 'ACTIVE' })
        .expect(200);

      // Un id de personal no es un cliente.
      await http()
        .patch(`/api/v1/admin/customers/${manager.id}/status`)
        .set(bearer(tokens))
        .send({ status: 'BLOCKED' })
        .expect(400);
    });
  });
});
