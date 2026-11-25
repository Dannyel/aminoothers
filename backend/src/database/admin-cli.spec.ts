import { parseAdminArgs, passwordProblems } from './admin-cli.js';

describe('parseAdminArgs', () => {
  it('usa ADMIN y nombres por defecto, y normaliza el correo', () => {
    expect(parseAdminArgs(['--email', '  Ana@Tienda.GT '])).toEqual({
      email: 'ana@tienda.gt',
      firstName: 'Administrador',
      lastName: 'General',
      role: 'ADMIN',
    });
  });

  it('acepta nombre, apellido y rol en cualquier orden', () => {
    expect(
      parseAdminArgs([
        '--rol',
        'super_admin',
        '--apellido',
        'López',
        '--email',
        'ana@tienda.gt',
        '--nombre',
        'Ana',
      ]),
    ).toEqual({
      email: 'ana@tienda.gt',
      firstName: 'Ana',
      lastName: 'López',
      role: 'SUPER_ADMIN',
    });
  });

  it.each([
    [[], /obligatorio/],
    [['--email', 'no-es-correo'], /no válido/],
    [['--email', 'a@b.gt', '--rol', 'CLIENTE'], /Rol no válido/],
    [['--email'], /Falta el valor/],
    [['--email', 'a@b.gt', '--password', 'x'], /desconocida/],
    [['--email', '--rol', 'ADMIN'], /Falta el valor/],
  ])('rechaza %j', (argv, message) => {
    expect(() => parseAdminArgs(argv)).toThrow(message);
  });
});

describe('passwordProblems', () => {
  it('acepta una contraseña que cumple la política', () => {
    expect(passwordProblems('Farmacia2026segura')).toEqual([]);
  });

  it('enumera todo lo que falta', () => {
    expect(passwordProblems('corta')).toEqual([
      'al menos 12 caracteres',
      'al menos un número',
    ]);
    expect(passwordProblems('123456789012')).toEqual(['al menos una letra']);
    expect(passwordProblems(`a1${'x'.repeat(127)}`)).toEqual([
      'como máximo 128 caracteres',
    ]);
  });
});
