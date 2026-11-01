import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { UserStatus } from '../src/generated/prisma/enums.js';
import { REFRESH_REUSE_GRACE_MS } from '../src/modules/auth/session.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import {
  createTestApp,
  type RecordingMailService,
} from './support/create-app.js';
import {
  bearer,
  createCustomer,
  createStaff,
  login,
  PASSWORD,
  resetDatabase,
} from './support/fixtures.js';

describe('Autenticación (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let mail: RecordingMailService;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, prisma, mail } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    mail.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('registro de clientes', () => {
    const body = {
      email: 'Ana.Lopez@Example.com',
      password: 'mi-clave-segura-9',
      firstName: ' Ana ',
      lastName: 'López',
    };

    it('crea el cliente sin verificar, normaliza datos y envía la verificación', async () => {
      await http().post('/api/v1/auth/register').send(body).expect(201);

      const user = await prisma.user.findUniqueOrThrow({
        where: { email: 'ana.lopez@example.com' },
        include: { customer: true },
      });
      expect(user).toMatchObject({
        type: 'CUSTOMER',
        firstName: 'Ana',
        emailVerifiedAt: null,
      });
      expect(user.customer?.taxId).toBe('CF');
      expect(user.passwordHash).toMatch(/^\$argon2id\$/);

      const token = mail.tokenFor('ana.lopez@example.com');
      await http()
        .post('/api/v1/auth/verify-email')
        .send({ token })
        .expect(200);
      const verified = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(verified.emailVerifiedAt).not.toBeNull();

      // El enlace es de un solo uso.
      await http()
        .post('/api/v1/auth/verify-email')
        .send({ token })
        .expect(400);
    });

    it('responde igual si el correo ya existe y avisa al dueño, sin duplicar', async () => {
      const first = await http()
        .post('/api/v1/auth/register')
        .send(body)
        .expect(201);
      mail.clear();
      const second = await http()
        .post('/api/v1/auth/register')
        .send({ ...body, email: 'ANA.LOPEZ@example.com' })
        .expect(201);

      expect(second.body).toEqual(first.body);
      expect(await prisma.user.count()).toBe(1);
      expect(mail.lastTo('ana.lopez@example.com')?.subject).toMatch(
        /Intento de registro/,
      );
    });

    it('rechaza contraseñas débiles y campos no permitidos', async () => {
      const weak = await http()
        .post('/api/v1/auth/register')
        .send({ ...body, password: 'corta' })
        .expect(400);
      expect(weak.body.message).toEqual(
        expect.arrayContaining([
          'La contraseña debe tener al menos 10 caracteres',
        ]),
      );

      await http()
        .post('/api/v1/auth/register')
        .send({ ...body, type: 'STAFF' })
        .expect(400);
    });
  });

  describe('inicio de sesión', () => {
    it('cada portal solo acepta su tipo de usuario', async () => {
      const customer = await createCustomer(prisma);
      const staff = await createStaff(prisma, ['ADMIN']);

      const tokens = await login(app, 'store', customer.email);
      expect(tokens).toMatchObject({
        user: { type: 'CUSTOMER', email: customer.email },
      });

      await http()
        .post('/api/v1/auth/store/login')
        .send({ email: staff.email, password: PASSWORD })
        .expect(401);
      await http()
        .post('/api/v1/auth/admin/login')
        .send({ email: customer.email, password: PASSWORD })
        .expect(401);
    });

    it('usa el mismo mensaje para correo inexistente y contraseña incorrecta', async () => {
      const customer = await createCustomer(prisma);
      const unknown = await http()
        .post('/api/v1/auth/store/login')
        .send({ email: 'nadie@prueba.gt', password: PASSWORD })
        .expect(401);
      const wrong = await http()
        .post('/api/v1/auth/store/login')
        .send({ email: customer.email, password: 'otra-clave-123' })
        .expect(401);
      expect(unknown.body.message).toBe(wrong.body.message);
    });

    it('bloquea temporalmente la cuenta tras 5 intentos fallidos', async () => {
      const customer = await createCustomer(prisma);
      for (let i = 0; i < 5; i++) {
        await http()
          .post('/api/v1/auth/store/login')
          .send({ email: customer.email, password: 'otra-clave-123' })
          .expect(401);
      }
      const locked = await http()
        .post('/api/v1/auth/store/login')
        .send({ email: customer.email, password: PASSWORD })
        .expect(401);
      expect(locked.body.message).toMatch(/Demasiados intentos/);
    });

    it('rechaza cuentas bloqueadas', async () => {
      const customer = await createCustomer(prisma);
      await prisma.user.update({
        where: { id: customer.id },
        data: { status: UserStatus.BLOCKED },
      });
      await http()
        .post('/api/v1/auth/store/login')
        .send({ email: customer.email, password: PASSWORD })
        .expect(403);
    });
  });

  describe('sesiones', () => {
    it('exige token y respeta el tipo de usuario', async () => {
      await http().get('/api/v1/auth/me').expect(401);
      await http()
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer token-invalido')
        .expect(401);

      const staff = await createStaff(prisma, ['ADMIN']);
      const tokens = await login(app, 'admin', staff.email);
      await http().get('/api/v1/store/profile').set(bearer(tokens)).expect(403);
    });

    it('rota el refresh token y detecta su reutilización fuera del margen', async () => {
      const customer = await createCustomer(prisma);
      const first = await login(app, 'store', customer.email);

      const second = await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: first.refreshToken })
        .expect(200);
      expect(second.body.refreshToken).not.toBe(first.refreshToken);
      await http().get('/api/v1/auth/me').set(bearer(second.body)).expect(200);

      // Dentro del margen (peticiones paralelas del BFF) el token anterior aún sirve.
      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: first.refreshToken })
        .expect(200);

      // Fuera del margen se considera robo: se revoca toda la sesión.
      await prisma.session.updateMany({
        where: { userId: customer.id, revokedAt: { not: null } },
        data: {
          revokedAt: new Date(Date.now() - REFRESH_REUSE_GRACE_MS - 1000),
        },
      });
      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: first.refreshToken })
        .expect(401);
      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: second.body.refreshToken })
        .expect(401);
      await http().get('/api/v1/auth/me').set(bearer(second.body)).expect(401);
    });

    it('logout invalida el access token y el refresh token de inmediato', async () => {
      const customer = await createCustomer(prisma);
      const tokens = await login(app, 'store', customer.email);
      const other = await login(app, 'store', customer.email);

      await http().post('/api/v1/auth/logout').set(bearer(tokens)).expect(204);
      await http().get('/api/v1/auth/me').set(bearer(tokens)).expect(401);
      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(401);
      // Las demás sesiones siguen activas.
      await http().get('/api/v1/auth/me').set(bearer(other)).expect(200);

      await http()
        .post('/api/v1/auth/logout-all')
        .set(bearer(other))
        .expect(204);
      await http().get('/api/v1/auth/me').set(bearer(other)).expect(401);
    });

    it('un usuario bloqueado pierde el acceso aunque su token no haya vencido', async () => {
      const customer = await createCustomer(prisma);
      const tokens = await login(app, 'store', customer.email);
      await prisma.user.update({
        where: { id: customer.id },
        data: { status: UserStatus.BLOCKED },
      });
      await http().get('/api/v1/auth/me').set(bearer(tokens)).expect(401);
      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(401);
    });
  });

  describe('contraseñas', () => {
    it('recuperación: no revela correos y restablece con un enlace de un solo uso', async () => {
      const customer = await createCustomer(prisma);
      const session = await login(app, 'store', customer.email);

      const unknown = await http()
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nadie@prueba.gt' })
        .expect(202);
      const known = await http()
        .post('/api/v1/auth/forgot-password')
        .send({ email: customer.email })
        .expect(202);
      expect(known.body).toEqual(unknown.body);
      expect(mail.messages).toHaveLength(1);

      const token = mail.tokenFor(customer.email);
      const reset = await http()
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'clave-nueva-2026' })
        .expect(200);
      expect(reset.body.type).toBe('CUSTOMER');

      await http()
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'otra-clave-2026' })
        .expect(400);
      await http()
        .post('/api/v1/auth/store/login')
        .send({ email: customer.email, password: PASSWORD })
        .expect(401);
      await login(app, 'store', customer.email, 'clave-nueva-2026');
      // Restablecer cierra las sesiones anteriores.
      await http().get('/api/v1/auth/me').set(bearer(session)).expect(401);
    });

    it('un enlace nuevo invalida el anterior', async () => {
      const customer = await createCustomer(prisma);
      await http()
        .post('/api/v1/auth/forgot-password')
        .send({ email: customer.email });
      const old = mail.tokenFor(customer.email);
      await http()
        .post('/api/v1/auth/forgot-password')
        .send({ email: customer.email });
      await http()
        .post('/api/v1/auth/reset-password')
        .send({ token: old, password: 'clave-nueva-2026' })
        .expect(400);
    });

    it('cambio de contraseña: valida la actual y cierra las otras sesiones', async () => {
      const customer = await createCustomer(prisma);
      const current = await login(app, 'store', customer.email);
      const other = await login(app, 'store', customer.email);

      await http()
        .post('/api/v1/auth/change-password')
        .set(bearer(current))
        .send({
          currentPassword: 'incorrecta-123',
          newPassword: 'clave-nueva-2026',
        })
        .expect(400);
      await http()
        .post('/api/v1/auth/change-password')
        .set(bearer(current))
        .send({ currentPassword: PASSWORD, newPassword: 'clave-nueva-2026' })
        .expect(200);

      await http().get('/api/v1/auth/me').set(bearer(current)).expect(200);
      await http().get('/api/v1/auth/me').set(bearer(other)).expect(401);
      expect(mail.lastTo(customer.email)?.subject).toMatch(
        /contraseña fue cambiada/,
      );
    });
  });

  describe('verificación de correo', () => {
    it('permite reenviar el enlace solo si falta verificar', async () => {
      await http()
        .post('/api/v1/auth/register')
        .send({
          email: 'nuevo@prueba.gt',
          password: 'mi-clave-segura-9',
          firstName: 'Nuevo',
          lastName: 'Cliente',
        })
        .expect(201);
      const tokens = await login(
        app,
        'store',
        'nuevo@prueba.gt',
        'mi-clave-segura-9',
      );
      expect(tokens).toMatchObject({ user: { emailVerified: false } });

      await http()
        .post('/api/v1/auth/resend-verification')
        .set(bearer(tokens))
        .expect(200);
      await http()
        .post('/api/v1/auth/verify-email')
        .send({ token: mail.tokenFor('nuevo@prueba.gt') })
        .expect(200);
      await http()
        .post('/api/v1/auth/resend-verification')
        .set(bearer(tokens))
        .expect(400);
    });
  });
});
