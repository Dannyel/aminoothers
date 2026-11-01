import { defineConfig } from 'prisma/config';

// El CLI de Prisma no carga .env por sí mismo. Si DATABASE_URL ya viene del
// entorno (CI, contenedor), se respeta; si no, se usa el archivo indicado en
// ENV_FILE (p. ej. .env.test) o, por defecto, .env.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(process.env.ENV_FILE ?? '.env');
  } catch {
    // Sin archivo .env: DATABASE_URL debe venir del entorno.
  }
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
    // Solo lo usa `prisma migrate dev`. Base dedicada para no depender de que
    // el rol pueda crear bases desde template1.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
