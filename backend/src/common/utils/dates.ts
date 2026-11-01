/** Zona horaria del negocio: los vencimientos y "hoy" se calculan en Guatemala. */
export const BUSINESS_TIME_ZONE = 'America/Guatemala';

/** Fecha de hoy en Guatemala como AAAA-MM-DD. */
export function todayInBusinessZone(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Suma días a una fecha AAAA-MM-DD (aritmética de calendario, sin horas). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** AAAA-MM-DD → Date a medianoche UTC, como Prisma maneja las columnas DATE. */
export function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

export function formatDateOnly(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

/**
 * Instante en que empieza un día AAAA-MM-DD en Guatemala (UTC−6 todo el año,
 * sin horario de verano). Para filtrar fechas y horas por día del negocio.
 */
export function businessDayStart(date: string): Date {
  return new Date(dateOnly(date).getTime() + 6 * 3_600_000);
}
