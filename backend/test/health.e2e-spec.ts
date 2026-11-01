import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/create-app.js';

describe('Infraestructura HTTP (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health confirma la conexión a PostgreSQL', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
    expect(Date.parse(res.body.timestamp)).not.toBeNaN();
  });

  it('expone el documento OpenAPI', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(res.body.paths).toHaveProperty('/api/v1/health');
  });

  it('permite CORS solo para los orígenes configurados', async () => {
    const allowed = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );

    const denied = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'https://otro-sitio.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('aplica cabeceras de seguridad', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('responde 404 en rutas inexistentes', async () => {
    await request(app.getHttpServer()).get('/api/v1/no-existe').expect(404);
  });
});
