import { renderMail } from '../mail/mail-layout.js';

export const authMails = {
  emailVerification: (name: string, url: string) =>
    renderMail({
      subject: 'Confirme su correo electrónico',
      paragraphs: [
        `Hola, ${name}:`,
        'Gracias por registrarse. Confirme su correo electrónico para poder realizar compras. El enlace vence en 48 horas.',
      ],
      action: { label: 'Confirmar correo', url },
    }),

  existingAccount: (name: string, loginUrl: string, resetUrl: string) =>
    renderMail({
      subject: 'Intento de registro con su correo',
      paragraphs: [
        `Hola, ${name}:`,
        'Alguien intentó crear una cuenta con este correo, pero usted ya tiene una. Si fue usted, inicie sesión o recupere su contraseña. Si no fue usted, puede ignorar este mensaje.',
        `Recuperar contraseña: ${resetUrl}`,
      ],
      action: { label: 'Iniciar sesión', url: loginUrl },
    }),

  passwordReset: (name: string, url: string) =>
    renderMail({
      subject: 'Restablezca su contraseña',
      paragraphs: [
        `Hola, ${name}:`,
        'Recibimos una solicitud para restablecer su contraseña. El enlace vence en 30 minutos y solo puede usarse una vez. Si no la solicitó, ignore este mensaje.',
      ],
      action: { label: 'Restablecer contraseña', url },
    }),

  staffInvitation: (name: string, url: string) =>
    renderMail({
      subject: 'Acceso al panel administrativo',
      paragraphs: [
        `Hola, ${name}:`,
        'Se creó su usuario en el panel administrativo de la farmacia. Defina su contraseña con el siguiente enlace, que vence en 72 horas.',
      ],
      action: { label: 'Definir contraseña', url },
    }),

  mfaReset: (name: string) =>
    renderMail({
      subject: 'Se restableció su doble factor',
      paragraphs: [
        `Hola, ${name}:`,
        'Un administrador restableció el doble factor de su cuenta y se cerraron sus sesiones. En su próximo inicio de sesión deberá configurar de nuevo su app autenticadora. Si usted no lo solicitó, comuníquese con la farmacia.',
      ],
    }),

  passwordChanged: (name: string) =>
    renderMail({
      subject: 'Su contraseña fue cambiada',
      paragraphs: [
        `Hola, ${name}:`,
        'La contraseña de su cuenta fue cambiada y se cerraron sus otras sesiones. Si no fue usted, restablezca su contraseña de inmediato y contacte a la farmacia.',
      ],
    }),
};
