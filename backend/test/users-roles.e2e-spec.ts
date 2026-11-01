import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import {
  createTestApp,
  type RecordingMailService,
} from './support/create-app.js';
import {
  bearer,
  createCustomer,
  createStaff,
  createStaffWithPermissions,
  login,
  resetDatabase,
  type Tokens,
} from './support/fixtures.js';

describe('Usuarios administrativos, roles y permisos (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let mail: RecordingMailService;
  let superAdmin: Tokens;
  let superAdminId: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, prisma, mail } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    mail.clear();
    const user = await createStaff(prisma, ['SUPER_ADMIN']);
    superAdminId = user.id;
    superAdmin = await login(app, 'admin', user.email);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('control de acceso', () => {
    it('niega el panel a clientes y a personal sin el permiso', async () => {
      const customer = await createCustomer(prisma);
      const customerTokens = await login(app, 'store', customer.email);
      await http()
        .get('/api/v1/admin/users')
        .set(bearer(customerTokens))
        .expect(403);

      const reader = await createStaffWithPermissions(prisma, [
        'customers.read',
      ]);
      const readerTokens = await login(app, 'admin', reader.email);
      await http()
        .get('/api/v1/admin/users')
        .set(bearer(readerTokens))
        .expect(403);
      await http()
        .get('/api/v1/admin/customers')
        .set(bearer(readerTokens))
        .expect(200);
    });

    it('los cambios de permisos de un rol aplican sin volver a iniciar sesión', async () => {
      const staff = await createStaffWithPermissions(prisma, []);
      const tokens = await login(app, 'admin', staff.email);
      await http().get('/api/v1/admin/roles').set(bearer(tokens)).expect(403);

      const role = await prisma.role.findFirstOrThrow({
        where: { users: { some: { userId: staff.id } } },
      });
      await http()
        .patch(`/api/v1/admin/roles/${role.id}`)
        .set(bearer(superAdmin))
        .send({ permissions: ['roles.read'] })
        .expect(200);
      await http().get('/api/v1/admin/roles').set(bearer(tokens)).expect(200);
    });

    it('el superadministrador recibe todos los permisos en /auth/me', async () => {
      const me = await http()
        .get('/api/v1/auth/me')
        .set(bearer(superAdmin))
        .expect(200);
      const catalog = await http()
        .get('/api/v1/admin/permissions')
        .set(bearer(superAdmin))
        .expect(200);
      expect(me.body.permissions).toEqual(
        catalog.body.map((p: { code: string }) => p.code).sort(),
      );
    });
  });

  describe('usuarios', () => {
    it('crea un usuario e invita por correo a definir la contraseña', async () => {
      const sales = await prisma.role.findUniqueOrThrow({
        where: { code: 'SALES' },
      });
      const created = await http()
        .post('/api/v1/admin/users')
        .set(bearer(superAdmin))
        .send({
          email: 'Vendedor@Farmacia.gt',
          firstName: 'Luis',
          lastName: 'Pérez',
          roleIds: [sales.id],
        })
        .expect(201);
      expect(created.body).toMatchObject({
        email: 'vendedor@farmacia.gt',
        status: 'ACTIVE',
        roles: [{ code: 'SALES' }],
      });
      expect(mail.lastTo('vendedor@farmacia.gt')?.subject).toMatch(
        /panel administrativo/,
      );

      await http()
        .post('/api/v1/auth/reset-password')
        .send({
          token: mail.tokenFor('vendedor@farmacia.gt'),
          password: 'clave-del-vendedor-1',
        })
        .expect(200);
      const tokens = await login(
        app,
        'admin',
        'vendedor@farmacia.gt',
        'clave-del-vendedor-1',
      );
      await http()
        .get('/api/v1/admin/customers')
        .set(bearer(tokens))
        .expect(200);

      await http()
        .post('/api/v1/admin/users')
        .set(bearer(superAdmin))
        .send({
          email: 'vendedor@farmacia.gt',
          firstName: 'X',
          lastName: 'Y',
          roleIds: [],
        })
        .expect(409);
    });

    it('users.manage puede listar los roles asignables sin roles.read', async () => {
      const manager = await createStaffWithPermissions(prisma, [
        'users.manage',
      ]);
      const tokens = await login(app, 'admin', manager.email);
      const res = await http()
        .get('/api/v1/admin/users/assignable-roles')
        .set(bearer(tokens))
        .expect(200);
      expect(res.body.map((r: { code: string }) => r.code)).toContain('SALES');
      await http().get('/api/v1/admin/roles').set(bearer(tokens)).expect(403);
    });

    it('lista con búsqueda, filtro y paginación', async () => {
      await createStaff(prisma, [], { email: 'maria.gomez@farmacia.gt' });
      await createStaff(prisma, []);
      const res = await http()
        .get('/api/v1/admin/users?search=gomez&pageSize=5')
        .set(bearer(superAdmin))
        .expect(200);
      expect(res.body).toMatchObject({ total: 1, page: 1, pageSize: 5 });
      expect(res.body.items[0].email).toBe('maria.gomez@farmacia.gt');
    });

    it('bloquear cierra las sesiones; nadie puede cambiar su propio estado ni roles', async () => {
      const staff = await createStaff(prisma, ['ADMIN']);
      const tokens = await login(app, 'admin', staff.email);

      await http()
        .patch(`/api/v1/admin/users/${staff.id}/status`)
        .set(bearer(superAdmin))
        .send({ status: 'BLOCKED' })
        .expect(200);
      await http().get('/api/v1/auth/me').set(bearer(tokens)).expect(401);

      await http()
        .patch(`/api/v1/admin/users/${superAdminId}/status`)
        .set(bearer(superAdmin))
        .send({ status: 'INACTIVE' })
        .expect(400);
      await http()
        .put(`/api/v1/admin/users/${superAdminId}/roles`)
        .set(bearer(superAdmin))
        .send({ roleIds: [] })
        .expect(400);
    });

    it('impide dejar el sistema sin superadministradores activos', async () => {
      const admin = await createStaff(prisma, ['ADMIN']);
      const adminTokens = await login(app, 'admin', admin.email);

      await http()
        .put(`/api/v1/admin/users/${superAdminId}/roles`)
        .set(bearer(adminTokens))
        .send({ roleIds: [] })
        .expect(409);
      await http()
        .patch(`/api/v1/admin/users/${superAdminId}/status`)
        .set(bearer(adminTokens))
        .send({ status: 'BLOCKED' })
        .expect(409);

      // Con otro superadministrador activo, sí se permite.
      await createStaff(prisma, ['SUPER_ADMIN']);
      await http()
        .patch(`/api/v1/admin/users/${superAdminId}/status`)
        .set(bearer(adminTokens))
        .send({ status: 'BLOCKED' })
        .expect(200);
    });

    it('rechaza ids inexistentes o mal formados', async () => {
      await http()
        .get('/api/v1/admin/users/no-es-uuid')
        .set(bearer(superAdmin))
        .expect(400);
      await http()
        .get('/api/v1/admin/users/01a1946a-35ac-7393-aa91-ebd25e542e81')
        .set(bearer(superAdmin))
        .expect(404);
    });
  });

  describe('roles', () => {
    it('crea, edita y elimina roles personalizados', async () => {
      const created = await http()
        .post('/api/v1/admin/roles')
        .set(bearer(superAdmin))
        .send({
          code: 'cajero',
          name: 'Cajero',
          permissions: ['customers.read'],
        })
        .expect(201);
      expect(created.body).toMatchObject({
        code: 'CAJERO',
        isSystem: false,
        permissions: ['customers.read'],
      });

      await http()
        .post('/api/v1/admin/roles')
        .set(bearer(superAdmin))
        .send({ code: 'CAJERO', name: 'Otro', permissions: [] })
        .expect(409);
      await http()
        .post('/api/v1/admin/roles')
        .set(bearer(superAdmin))
        .send({ code: 'OTRO', name: 'Otro', permissions: ['no.existe'] })
        .expect(400);

      const updated = await http()
        .patch(`/api/v1/admin/roles/${created.body.id}`)
        .set(bearer(superAdmin))
        .send({
          name: 'Caja',
          permissions: ['customers.read', 'customers.manage'],
        })
        .expect(200);
      expect(updated.body.permissions).toEqual([
        'customers.manage',
        'customers.read',
      ]);

      await http()
        .delete(`/api/v1/admin/roles/${created.body.id}`)
        .set(bearer(superAdmin))
        .expect(204);
    });

    it('protege los roles de sistema y los roles en uso', async () => {
      const superRole = await prisma.role.findUniqueOrThrow({
        where: { code: 'SUPER_ADMIN' },
      });
      const salesRole = await prisma.role.findUniqueOrThrow({
        where: { code: 'SALES' },
      });

      await http()
        .patch(`/api/v1/admin/roles/${superRole.id}`)
        .set(bearer(superAdmin))
        .send({ permissions: [] })
        .expect(400);
      await http()
        .delete(`/api/v1/admin/roles/${salesRole.id}`)
        .set(bearer(superAdmin))
        .expect(400);

      const custom = await http()
        .post('/api/v1/admin/roles')
        .set(bearer(superAdmin))
        .send({ code: 'EN_USO', name: 'En uso', permissions: [] })
        .expect(201);
      const staff = await createStaff(prisma, ['EN_USO']);
      expect(staff).toBeDefined();
      await http()
        .delete(`/api/v1/admin/roles/${custom.body.id}`)
        .set(bearer(superAdmin))
        .expect(409);
    });

    it('ADMIN puede consultar roles pero no gestionarlos', async () => {
      const admin = await createStaff(prisma, ['ADMIN']);
      const tokens = await login(app, 'admin', admin.email);
      await http().get('/api/v1/admin/roles').set(bearer(tokens)).expect(200);
      await http()
        .post('/api/v1/admin/roles')
        .set(bearer(tokens))
        .send({ code: 'NUEVO', name: 'Nuevo', permissions: [] })
        .expect(403);
    });
  });
});
