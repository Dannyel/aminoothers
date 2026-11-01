import type { NestExpressApplication } from '@nestjs/platform-express';
import { RetentionService } from '../src/modules/maintenance/retention.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './support/create-app.js';
import { createStaff, resetDatabase } from './support/fixtures.js';

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

describe('Retención de datos (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('borra solo lo que superó su plazo (D20)', async () => {
    const staff = await createStaff(prisma, ['ADMIN']);
    await prisma.auditLog.createMany({
      data: [
        {
          userId: staff.id,
          action: 'viejo',
          module: 'products',
          createdAt: ago(6 * 366),
        },
        {
          userId: staff.id,
          action: 'reciente',
          module: 'products',
          createdAt: ago(4 * 365),
        },
      ],
    });
    const mail = (status: 'SENT' | 'FAILED' | 'PENDING', days: number) => ({
      type: 'ORDER_PLACED' as const,
      recipient: 'a@b.gt',
      payload: {},
      status,
      sentAt: status === 'SENT' ? ago(days) : null,
      createdAt: ago(days),
    });
    await prisma.notificationLog.createMany({
      data: [
        mail('SENT', 200),
        mail('SENT', 10),
        mail('FAILED', 400),
        mail('PENDING', 300),
      ],
    });
    await prisma.session.createMany({
      data: [
        {
          userId: staff.id,
          familyId: staff.id,
          tokenHash: 'h1',
          createdAt: ago(70),
          expiresAt: ago(40),
        },
        {
          userId: staff.id,
          familyId: staff.id,
          tokenHash: 'h2',
          expiresAt: ago(-5),
        },
      ],
    });
    await prisma.userToken.createMany({
      data: [
        {
          userId: staff.id,
          purpose: 'PASSWORD_RESET',
          tokenHash: 't1',
          createdAt: ago(9),
          expiresAt: ago(8),
        },
        {
          userId: staff.id,
          purpose: 'PASSWORD_RESET',
          tokenHash: 't2',
          expiresAt: ago(-1),
        },
      ],
    });

    // El trigger impide borrar auditoría reciente aunque sea a mano.
    await expect(
      prisma.auditLog.deleteMany({ where: { action: 'reciente' } }),
    ).rejects.toThrow();

    const result = await app.get(RetentionService).purge();
    expect(result).toEqual({
      notifications: 1,
      auditLogs: 1,
      sessions: 1,
      tokens: 1,
      mfaChallenges: 0,
    });
    expect((await prisma.auditLog.findMany()).map((a) => a.action)).toEqual([
      'reciente',
    ]);
    expect(
      (
        await prisma.notificationLog.findMany({ orderBy: { createdAt: 'asc' } })
      ).map((n) => n.status),
    ).toEqual(['FAILED', 'PENDING', 'SENT']);
    expect(await prisma.session.count()).toBe(1);
    expect(await prisma.userToken.count()).toBe(1);
  });
});
