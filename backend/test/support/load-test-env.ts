// Se ejecuta antes de cada archivo e2e (setupFiles en vitest.config.e2e.ts).
// Las variables ya presentes en el entorno (p. ej. en CI) tienen prioridad.
try {
  process.loadEnvFile('.env.test');
} catch {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'Falta .env.test o DATABASE_URL: las pruebas e2e necesitan una base de datos PostgreSQL de prueba.',
    );
  }
}
