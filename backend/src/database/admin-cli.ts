/**
 * Lógica pura del comando `pnpm admin:create`: lectura de argumentos y reglas
 * de la contraseña. Separada del script para poder probarla sin base de datos.
 */

/** Roles del personal que se pueden asignar desde la línea de comandos. */
export const STAFF_ROLE_CODES = [
  'SUPER_ADMIN',
  'ADMIN',
  'PHARMACIST',
  'WAREHOUSE',
  'SALES',
  'FINANCE',
] as const;
export type StaffRoleCode = (typeof STAFF_ROLE_CODES)[number];

export interface AdminArgs {
  email: string;
  firstName: string;
  lastName: string;
  role: StaffRoleCode;
}

export const USAGE = `Uso: pnpm admin:create --email <correo> [--nombre <nombre>] [--apellido <apellido>] [--rol <ROL>]

  --email      Correo del nuevo usuario (obligatorio).
  --nombre     Nombre (por defecto "Administrador").
  --apellido   Apellido (por defecto "General").
  --rol        ${STAFF_ROLE_CODES.join(', ')} (por defecto ADMIN).

La contraseña se pide en la terminal sin mostrarse. Sin terminal (por ejemplo en
un contenedor sin -it) se toma de la variable ADMIN_PASSWORD. Nunca se recibe
como argumento, para que no quede en el historial del shell.`;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Convierte los argumentos en datos válidos o lanza un error con el motivo. */
export function parseAdminArgs(argv: readonly string[]): AdminArgs {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const aliases: Record<string, string> = {
      '--email': 'email',
      '--nombre': 'firstName',
      '--apellido': 'lastName',
      '--rol': 'role',
    };
    const key = aliases[flag];
    if (!key) throw new Error(`Opción desconocida: ${flag}`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Falta el valor de ${flag}`);
    }
    values.set(key, value.trim());
    i++;
  }

  const email = values.get('email')?.toLowerCase();
  if (!email) throw new Error('El correo es obligatorio (--email).');
  if (email.length > 254 || !EMAIL.test(email)) {
    throw new Error(`Correo no válido: ${email}`);
  }

  const role = (values.get('role') ?? 'ADMIN').toUpperCase();
  if (!(STAFF_ROLE_CODES as readonly string[]).includes(role)) {
    throw new Error(
      `Rol no válido: ${role}. Use uno de: ${STAFF_ROLE_CODES.join(', ')}.`,
    );
  }

  const firstName = values.get('firstName') || 'Administrador';
  const lastName = values.get('lastName') || 'General';
  if (firstName.length > 100 || lastName.length > 100) {
    throw new Error('El nombre y el apellido admiten hasta 100 caracteres.');
  }

  return { email, firstName, lastName, role: role as StaffRoleCode };
}

/**
 * Reglas de la contraseña del personal: las de la aplicación (letra y número,
 * hasta 128) con un mínimo de 12 caracteres, como el superadministrador inicial.
 * Devuelve los problemas encontrados; una lista vacía significa que es válida.
 */
export function passwordProblems(password: string): string[] {
  const problems: string[] = [];
  if (password.length < 12) problems.push('al menos 12 caracteres');
  if (password.length > 128) problems.push('como máximo 128 caracteres');
  if (!/\p{L}/u.test(password)) problems.push('al menos una letra');
  if (!/\d/.test(password)) problems.push('al menos un número');
  return problems;
}
