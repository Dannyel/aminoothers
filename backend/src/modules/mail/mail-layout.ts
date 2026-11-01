const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapa texto para insertarlo en HTML (nombres, motivos, etc.). */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

export interface MailContent {
  subject: string;
  /** Párrafos de texto plano (no se interpretan como HTML). */
  paragraphs: string[];
  action?: { label: string; url: string };
}

/** Arma las versiones de texto y HTML de un correo con un diseño único. */
export function renderMail(content: MailContent): {
  subject: string;
  text: string;
  html: string;
} {
  const text = [
    ...content.paragraphs,
    ...(content.action
      ? [`${content.action.label}: ${content.action.url}`]
      : []),
  ].join('\n\n');

  const paragraphs = content.paragraphs
    .map((p) => `<p style="margin:0 0 16px">${escapeHtml(p)}</p>`)
    .join('');
  const action = content.action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(content.action.url)}" style="background:#0f766e;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block">${escapeHtml(content.action.label)}</a></p>
       <p style="margin:0 0 16px;font-size:12px;color:#64748b">Si el botón no funciona, copie este enlace: ${escapeHtml(content.action.url)}</p>`
    : '';
  const html = `<!doctype html><html lang="es"><body style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;max-width:560px;margin:0 auto;padding:24px">${paragraphs}${action}</body></html>`;

  return { subject: content.subject, text, html };
}
