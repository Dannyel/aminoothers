import { MailTransport, NodeEnv, validateEnv } from './env.validation.js';

const base = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  CORS_ORIGINS: 'http://localhost:5173',
  FRONTEND_URL: 'http://localhost:5173',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  TOTP_ENCRYPTION_KEY: 'a'.repeat(64),
  MAIL_FROM: 'Farmacia <no-responder@farmacia.local>',
};

const smtp = { MAIL_TRANSPORT: 'smtp', SMTP_HOST: 'smtp.example.com' };

describe('validateEnv', () => {
  it('usa el transporte de correo "log" por defecto fuera de producción', () => {
    expect(validateEnv(base).MAIL_TRANSPORT).toBe(MailTransport.Log);
  });

  it('exige SMTP en producción', () => {
    expect(() =>
      validateEnv({ ...base, NODE_ENV: 'production', MAIL_TRANSPORT: 'log' }),
    ).toThrow(/MAIL_TRANSPORT debe ser smtp/);
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow(
      /SMTP_HOST/,
    );
    expect(
      validateEnv({ ...base, ...smtp, NODE_ENV: 'production' }).MAIL_TRANSPORT,
    ).toBe(MailTransport.Smtp);
  });

  it('rechaza un secreto JWT corto', () => {
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: 'corto' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('aplica valores por defecto y convierte números', () => {
    const env = validateEnv({ ...base, PORT: '4000' });
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe(NodeEnv.Development);
    expect(env.THROTTLE_LIMIT).toBe(120);
  });

  it('habilita Swagger por defecto fuera de producción', () => {
    expect(validateEnv(base).SWAGGER_ENABLED).toBe(true);
  });

  it('deshabilita Swagger por defecto en producción', () => {
    expect(
      validateEnv({ ...base, ...smtp, NODE_ENV: 'production' }).SWAGGER_ENABLED,
    ).toBe(false);
  });

  it('respeta SWAGGER_ENABLED=false explícito', () => {
    expect(
      validateEnv({ ...base, SWAGGER_ENABLED: 'false' }).SWAGGER_ENABLED,
    ).toBe(false);
  });

  it('rechaza un SWAGGER_ENABLED que no es booleano', () => {
    expect(() => validateEnv({ ...base, SWAGGER_ENABLED: 'quizas' })).toThrow(
      /SWAGGER_ENABLED/,
    );
  });

  it('rechaza una DATABASE_URL que no es de PostgreSQL', () => {
    expect(() =>
      validateEnv({ ...base, DATABASE_URL: 'mysql://localhost/db' }),
    ).toThrow(/DATABASE_URL/);
  });

  it('rechaza variables obligatorias ausentes', () => {
    expect(() => validateEnv({ DATABASE_URL: base.DATABASE_URL })).toThrow(
      /Variables de entorno inválidas/,
    );
  });

  it('rechaza un puerto fuera de rango', () => {
    expect(() => validateEnv({ ...base, PORT: '70000' })).toThrow();
  });
});
