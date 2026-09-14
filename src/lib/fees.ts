/**
 * Kolek — capa de compatibilidad sobre el nuevo PaymentFeeEngine
 * (src/lib/fee-engine.ts).
 *
 * Este archivo existe para que el resto de la app (checkout público,
 * dashboard, settings) no tenga que cambiar todas sus llamadas de golpe.
 * Internamente ya NO usa la fórmula fija `monto × 1.0406 + $3.48` — calcula
 * con gross-up real contra DEFAULT_FEE_CONFIG (política: el tutor absorbe,
 * igual que antes por default). Los totales mostrados cambian ligeramente
 * (unos pesos más arriba) respecto al MVP porque la fórmula vieja SÍ tenía
 * un error matemático: sumar el porcentaje directo sobre el monto base no
 * deja a la escuela su neto exacto una vez que el proveedor cobra su
 * comisión SOBRE el monto que pagó el tutor. Ver fee-engine.ts.
 */
import { DEFAULT_FEE_CONFIG, calcularDesglose, type FeeConfig } from '@/lib/fee-engine';
import { centavosToPesos, pesosToCentavos } from '@/lib/money';

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Total que se le cobra al tutor para que a la escuela le llegue `montoConcepto` limpio. */
export function calcTotalConComision(montoConcepto: number, config: FeeConfig = DEFAULT_FEE_CONFIG): number {
  const monto = Number(montoConcepto) || 0;
  if (monto <= 0) return 0;
  const d = calcularDesglose(pesosToCentavos(monto), config);
  return centavosToPesos(d.payerTotalCentavos);
}

/** Solo la parte de comisión, para mostrar el desglose al tutor. */
export function calcComision(montoConcepto: number, config: FeeConfig = DEFAULT_FEE_CONFIG): number {
  const monto = Number(montoConcepto) || 0;
  if (monto <= 0) return 0;
  const d = calcularDesglose(pesosToCentavos(monto), config);
  return centavosToPesos(d.feeCentavos);
}

/** Desglose completo (en pesos) listo para pintar en la página pública de pago. */
export function desglose(montoConcepto: number, config: FeeConfig = DEFAULT_FEE_CONFIG) {
  const monto = Number(montoConcepto) || 0;
  const d = calcularDesglose(pesosToCentavos(monto), config);
  return {
    concepto: centavosToPesos(d.netCentavos),
    comision: centavosToPesos(d.feeCentavos),
    total: centavosToPesos(d.payerTotalCentavos),
    escuelaRecibe: centavosToPesos(d.schoolReceivesCentavos),
    policy: d.policy,
  };
}

const MXN = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
});

/** $1,234.56 */
export function formatMXN(n: number | string | null | undefined): string {
  const value = Number(n ?? 0);
  return MXN.format(Number.isFinite(value) ? value : 0);
}

/** $1,235 — para KPIs grandes donde los centavos son ruido. */
export function formatMXNCompact(n: number | string | null | undefined): string {
  const value = Number(n ?? 0);
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}
