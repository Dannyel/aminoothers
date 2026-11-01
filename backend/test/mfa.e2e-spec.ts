import type { NestExpressApplication } from '@nestjs/platform-express';
import argon2 from 'argon2';
import request from 'supertest';
import { currentStep, totpCode } from '../src/common/utils/totp.js';
import { UserStatus, UserType } from '../src/generated/prisma/enums.js';
import { MFA_MAX_ATTEMPTS } from '../src/modules/auth/mfa.service.js';
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
  PASSWORD,
  resetDatabase,
  totpFor,
} from './support/fixtures.js';

describe('Doble factor TOTP (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let mail: RecordingMailService;
  const http = () => request(app.getHttpServer());

  const challenge = async (
    email: string,
    portal: 'store' | 'admin' = 'store',
  ) =>
    (
      await http()
        .post(`/api/v1/auth/${portal}/login`)
        .send({ email, password: PASSWORD })
        .expect(200)
    ).body as { mfaToken: string; enrollmentRequired: boolean };

  /** Cliente sin doble factor configurado (como recién registrado). */
  const newCustomer = async () =>
    prisma.user.create({
      data: {
        email: `nuevo.${Date.now()}@prueba.gt`,
        passwordHash: await argon2.hash(PASSWORD, { type: argon2.argon2id }),
        type: UserType.CUSTOMER,
        firstName: 'Nuevo',
        lastName: 'Cliente',
        emailVerifiedAt: new Date(),
        customer: { create: {} },
      },
    });

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

  it('la contraseña sola no entrega tokens', async () => {
    const customer = await createCustomer(prisma);
    const body = await challenge(customer.email);
    expect(body).toMatchObject({ enrollmentRequired: false });
    expect(body).not.toHaveProperty('accessToken');
    expect(await prisma.session.count()).toBe(0);
  });

  describe('configuración inicial', () => {
    it('exige configurar la app y entrega 10 códigos de recuperación', async () => {
      const user = await newCustomer();
      const { mfaToken, enrollmentRequired } = await challenge(user.email);
      expect(enrollmentRequired).toBe(true);

      const first = await http()
        .post('/api/v1/auth/mfa/enroll')
        .send({ mfaToken })
        .expect(200);
      expect(first.body.otpauthUri).toMatch(/^otpauth:\/\/totp\//);
      // Recargar la página no cambia el secreto ya escaneado.
      const again = await http()
        .post('/api/v1/auth/mfa/enroll')
        .send({ mfaToken })
        .expect(200);
      expect(again.body.secret).toBe(first.body.secret);

      // El secreto se guarda cifrado.
      const stored = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(stored.totpSecret).not.toContain(first.body.secret);

      await http()
        .post('/api/v1/auth/mfa/enroll/confirm')
        .send({ mfaToken, code: '000000' })
        .expect(401);
      const confirmed = await http()
        .post('/api/v1/auth/mfa/enroll/confirm')
        .send({ mfaToken, code: totpCode(first.body.secret, currentStep()) })
        .expect(200);
      expect(confirmed.body.recoveryCodes).toHaveLength(10);
      expect(confirmed.body.user.mfaEnabled).toBe(true);

      expect((await challenge(user.email)).enrollmentRequired).toBe(false);
    });

    it('no permite reconfigurar con un desafío si ya está configurado', async () => {
      const customer = await createCustomer(prisma);
      const { mfaToken } = await challenge(customer.email);
      await http()
        .post('/api/v1/auth/mfa/enroll')
        .send({ mfaToken })
        .expect(400);
    });
  });

  describe('verificación', () => {
    it('limita los intentos por desafío', async () => {
      const customer = await createCustomer(prisma);
      const { mfaToken } = await challenge(customer.email);
      for (let i = 0; i < MFA_MAX_ATTEMPTS; i++) {
        await http()
          .post('/api/v1/auth/mfa/verify')
          .send({ mfaToken, code: '000000' })
          .expect(401);
      }
      const code = await totpFor(prisma, customer.email);
      const blocked = await http()
        .post('/api/v1/auth/mfa/verify')
        .send({ mfaToken, code })
        .expect(401);
      expect(blocked.body.message).toMatch(/Inicie sesión de nuevo/);
    });

    it('cada desafío y cada código sirven una sola vez', async () => {
      const customer = await createCustomer(prisma);
      const first = await challenge(customer.email);
      const code = await totpFor(prisma, customer.email);
      await http()
        .post('/api/v1/auth/mfa/verify')
        .send({ mfaToken: first.mfaToken, code })
        .expect(200);
      await http()
        .post('/api/v1/auth/mfa/verify')
        .send({ mfaToken: first.mfaToken, code })
        .expect(401);

      // El mismo código no se acepta en otro inicio de sesión.
      const second = await challenge(customer.email);
      await http()
        .post('/api/v1/auth/mfa/verify')
        .send({ mfaToken: second.mfaToken, code })
        .expect(401);
    });

    it('el desafío vence', async () => {
      const customer = await createCustomer(prisma);
      const { mfaToken } = await challenge(customer.email);
      await prisma.mfaChallenge.updateMany({
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await http()
        .post('/api/v1/auth/mfa/verify')
        .send({ mfaToken, code: await totpFor(prisma, customer.email) })
        .expect(401);
    });

    it('un usuario bloqueado no puede completar el inicio de sesión', async () => {
      const customer = await createCustomer(prisma);
      const { mfaToken } = await challenge(customer.email);
      await prisma.user.update({
        where: { id: customer.id },
        data: { status: UserStatus.BLOCKED },
      });
      await http()
        .post('/api/v1/auth/mfa/verify')
        .send({ mfaToken, code: await totpFor(prisma, customer.email) })
        .expect(401);
    });

    it('exige exactamente uno: código de la app o de recuperación', async () => {
      const customer = await createCustomer(prisma);
      const { mfaToken } = await challenge(customer.email);
      await http()
        .post('/api/v1/auth/mfa/verify')
        .send({ mfaToken })
        .expect(400);
    });
  });

  describe('códigos de recuperación', () => {
    it('cada código sirve una vez y se aceptan sin guion ni mayúsculas', async () => {
      const user = await newCustomer();
      const { recoveryCodes } = await login(app, 'store', user.email);
      const [code] = recoveryCodes!;

      const first = await challenge(user.email);
      const tokens = await http()
        .post('/api/v1/auth/mfa/verify')
        .send({
          mfaToken: first.mfaToken,
          recoveryCode: code.replace('-', '').toLowerCase(),
        })
        .expect(200);
      const status = await http()
        .get('/api/v1/auth/mfa')
        .set(bearer(tokens.body))
        .expect(200);
      expect(status.body).toMatchObject({
        enabled: true,
        recoveryCodesRemaining: 9,
      });

      const second = await challenge(user.email);
      await http()
        .post('/api/v1/auth/mfa/verify')
        .send({ mfaToken: second.mfaToken, recoveryCode: code })
        .expect(401);
    });

    it('regenerarlos exige un código de la app e invalida los anteriores', async () => {
      const user = await newCustomer();
      const { recoveryCodes, ...tokens } = await login(
        app,
        'store',
        user.email,
      );

      await http()
        .post('/api/v1/auth/mfa/recovery-codes')
        .set(bearer(tokens))
        .send({ code: '000000' })
        .expect(400);
      const fresh = await http()
        .post('/api/v1/auth/mfa/recovery-codes')
        .set(bearer(tokens))
        .send({ code: await totpFor(prisma, user.email) })
        .expect(200);
      expect(fresh.body.recoveryCodes).toHaveLength(10);

      const { mfaToken } = await challenge(user.email);
      await http()
        .post('/api/v1/auth/mfa/verify')
        .send({ mfaToken, recoveryCode: recoveryCodes![0] })
        .expect(401);
    });
  });

  describe('restablecimiento administrativo', () => {
    it('obliga a configurar de nuevo, cierra sesiones y avisa al usuario', async () => {
      const admin = await createStaff(prisma, ['ADMIN']);
      const adminTokens = await login(app, 'admin', admin.email);
      const staff = await createStaff(prisma, ['SALES']);
      const staffTokens = await login(app, 'admin', staff.email);

      await http()
        .post(`/api/v1/admin/users/${staff.id}/mfa-reset`)
        .set(bearer(adminTokens))
        .expect(204);
      await http().get('/api/v1/auth/me').set(bearer(staffTokens)).expect(401);
      expect((await challenge(staff.email, 'admin')).enrollmentRequired).toBe(
        true,
      );
      expect(mail.lastTo(staff.email)?.subject).toMatch(/doble factor/);

      await http()
        .post(`/api/v1/admin/users/${admin.id}/mfa-reset`)
        .set(bearer(adminTokens))
        .expect(400);
    });

    it('clientes: requiere customers.manage', async () => {
      const customer = await createCustomer(prisma);
      const reader = await createStaffWithPermissions(prisma, [
        'customers.read',
      ]);
      const readerTokens = await login(app, 'admin', reader.email);
      await http()
        .post(`/api/v1/admin/customers/${customer.id}/mfa-reset`)
        .set(bearer(readerTokens))
        .expect(403);

      const manager = await createStaffWithPermissions(prisma, [
        'customers.read',
        'customers.manage',
      ]);
      const managerTokens = await login(app, 'admin', manager.email);
      await http()
        .post(`/api/v1/admin/customers/${customer.id}/mfa-reset`)
        .set(bearer(managerTokens))
        .expect(204);
      expect((await challenge(customer.email)).enrollmentRequired).toBe(true);
    });
  });
});
