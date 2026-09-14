/**
 * Dinero en Kolek se maneja SIEMPRE en centavos (enteros). Nunca en float.
 *
 * Por qué: 0.1 + 0.2 !== 0.3 en punto flotante. Un motor de cobranza que
 * acumula miles de sumas de dinero no puede darse ese lujo. Todo lo que
 * toca la base de datos nueva (billing_cycles, charges, payment_attempts,
 * manual_payments, subscriptions) usa columnas `integer`/`bigint` en
 * centavos: `monto_centavos`, `total_centavos`, etc.
 *
 * Las tablas heredadas del MVP (payments.monto_concepto, groups.monto_default,
 * students.monto_custom, concepts.monto_fijo) siguen en `numeric(12,2)` pesos
 * — no se tocan para no romper el flujo que ya funciona — pero se convierten
 * a centavos en el borde (`pesosToCentavos`) antes de cualquier cálculo nuevo.
 */

/** $1,234.56 (pesos, puede traer decimales de UI) → 123456 (centavos, entero). */
export function pesosToCentavos(pesos: number): number {
  if (!Number.isFinite(pesos)) return 0;
  return Math.round(pesos * 100);
}

/** 123456 (centavos) → 1234.56 (pesos, para mostrar o para APIs que piden pesos). */
export function centavosToPesos(centavos: number): number {
  if (!Number.isInteger(centavos)) {
    throw new Error(`centavosToPesos recibió un valor no entero: ${centavos}`);
  }
  return centavos / 100;
}

/** Suma segura de centavos (enteros, sin drift de punto flotante). */
export function sumCentavos(...valores: number[]): number {
  return valores.reduce((acc, v) => acc + Math.round(v), 0);
}

/** Reparte `total` centavos en `partes` según pesos relativos, sin perder ni un centavo. */
export function distribuirCentavos(total: number, pesos: number[]): number[] {
  const sumaPesos = pesos.reduce((a, b) => a + b, 0);
  if (sumaPesos <= 0) return pesos.map(() => 0);

  const crudos = pesos.map((p) => (total * p) / sumaPesos);
  const base = crudos.map((c) => Math.floor(c));
  let restante = Math.round(total - base.reduce((a, b) => a + b, 0));

  // El resto de centavos (por truncar) se reparte uno por uno empezando por
  // quien tuvo mayor parte decimal — así cuadra exacto al peso.
  const orden = crudos
    .map((c, i) => ({ i, frac: c - Math.floor(c) }))
    .sort((a, b) => b.frac - a.frac);

  const resultado = [...base];
  for (let k = 0; k < orden.length && restante > 0; k++) {
    resultado[orden[k].i]++;
    restante--;
  }
  return resultado;
}

const MXN_CENTAVOS = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
});

/** 123456 (centavos) → "$1,234.56" */
export function formatCentavos(centavos: number | null | undefined): string {
  const c = Number(centavos ?? 0);
  return MXN_CENTAVOS.format(Number.isFinite(c) ? c / 100 : 0);
}

/** 123456 (centavos) → "$1,235" — para KPIs grandes donde los centavos son ruido. */
export function formatCentavosCompact(centavos: number | null | undefined): string {
  const c = Number(centavos ?? 0);
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(c) ? c / 100 : 0);
}
