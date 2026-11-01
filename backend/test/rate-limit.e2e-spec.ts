import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

// Límite bajo solo para este archivo (Vitest aísla el entorno de cada archivo).
process.env.AUTH_THROTTLE_LIMIT = '3';

describe('Límite de peticiones de autenticación (e2e)', () => {
  let app: NestExpressApplication;
  const http = () => request(app.getHttpServer());
  const attempt = (ip: string) =>
    http()
      .post('/api/v1/auth/store/login')
      .set('X-Forwarded-For', ip)
      .send({ email: 'nadie@prueba.gt', password: 'clave-cualquiera-1' });

  beforeAll(async () => {
    const { createTestApp } = await import('./support/create-app.js');
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde 429 al superar el límite, por IP del cliente', async () => {
    for (let i = 0; i < 3; i++) await attempt('203.0.113.10').expect(401);
    await attempt('203.0.113.10').expect(429);

    // Otra IP reenviada por el BFF tiene su propio contador.
    await attempt('203.0.113.20').expect(401);
  });

  it('no aplica el límite estricto a los demás endpoints', async () => {
    for (let i = 0; i < 5; i++) {
      await http()
        .get('/api/v1/store/departments')
        .set('X-Forwarded-For', '203.0.113.10')
        .expect(200);
    }
  });
});
