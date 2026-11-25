/**
 * Crea un usuario del personal con rol de administración desde la terminal.
 * Sirve para dar de alta administradores adicionales o recuperar el acceso
 * cuando nadie puede entrar al panel. Para el personal habitual se usa el
 * panel (Usuarios → Nuevo), que envía una invitación por correo.
 *
 * Uso: `pnpm admin:create --email <correo> [--nombre] [--apellido] [--rol]`
 * (requiere `pnpm build` y haber corrido `pnpm db:seed`). Ver `pnpm admin:create --help`.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import { PrismaClient } from '../generated/prisma/client.js';
import { UserType } from '../generated/prisma/enums.js';
import { parseAdminArgs, passwordProblems, USAGE } from './admin-cli.js';

/** Lee una línea sin mostrar lo que se escribe. */
function promptHidden(question: string): Promise<string> {
  const { stdin, stdout } = process;
  return new Promise((resolve, reject) => {
    let value = '';
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const finish = (error?: Error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') return finish();
        if (char === '\u0003') return finish(new Error('Cancelado.'));
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else value += char;
      }
    };
    stdin.on('data', onData);
  });
}

async function readPassword(): Promise<string> {
  if (!process.stdin.isTTY) {
    const fromEnv = process.env.ADMIN_PASSWORD;
    if (!fromEnv) {
      throw new Error(
        'Sin terminal interactiva: defina la contraseña en la variable ADMIN_PASSWORD.',
      );
    }
    return fromEnv;
  }
  const password = await promptHidden('Contraseña: ');
  const problems = passwordProblems(password);
  if (problems.length > 0) {
    throw new Error(`La contraseña necesita ${problems.join(', ')}.`);
  }
  if ((await promptHidden('Repita la contraseña: ')) !== password) {
    throw new Error('Las contraseñas no coinciden.');
  }
  return password;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE);
    return;
  }
  const args = parseAdminArgs(argv);

  if (!process.env.DATABASE_URL) {
    process.loadEnvFile(process.env.ENV_FILE ?? '.env');
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    // Se valida todo lo posible antes de pedir la contraseña.
    const role = await prisma.role.findUnique({ where: { code: args.role } });
    if (!role) {
      throw new Error(
        `No existe el rol ${args.role}. Ejecute primero "pnpm db:seed".`,
      );
    }
    if (await prisma.user.findUnique({ where: { email: args.email } })) {
      throw new Error(
        `Ya existe un usuario con el correo ${args.email}. Si perdió el acceso, use "Recuperar contraseña" en el panel.`,
      );
    }

    const password = await readPassword();
    const problems = passwordProblems(password);
    if (problems.length > 0) {
      throw new Error(`La contraseña necesita ${problems.join(', ')}.`);
    }

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: args.email,
          passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
          type: UserType.STAFF,
          firstName: args.firstName,
          lastName: args.lastName,
          emailVerifiedAt: new Date(),
          roles: { create: { roleId: role.id } },
        },
      });
      // Queda en la auditoría, como cualquier alta de personal.
      await tx.auditLog.create({
        data: {
          action: 'create',
          module: 'users',
          route: 'CLI admin:create',
          entityId: created.id,
          changes: {
            email: args.email,
            firstName: args.firstName,
            lastName: args.lastName,
            role: args.role,
          },
        },
      });
      return created;
    });

    console.log(`Usuario ${user.email} creado con el rol ${role.name}.`);
    console.log(
      'Al ingresar al panel (/admin) se le pedirá configurar el doble factor.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  if (
    error instanceof Error &&
    /Opción|valor|obligatorio/.test(error.message)
  ) {
    console.error(`\n${USAGE}`);
  }
  process.exitCode = 1;
}
