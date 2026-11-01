/** Número visible del pedido: PED-000123. */
export function orderLabel(number: number): string {
  return `PED-${String(number).padStart(6, '0')}`;
}
