/**
 * ── PaymentFeeEngine ─────────────────────────────────────────────────────
 * Reemplaza la fórmula fija `monto × 1.0406 + $3.48` (que sumaba el
 * porcentaje directo sobre el monto base — matemáticamente incorrecto: si
 * el proveedor cobra su comisión SOBRE el monto que paga el tutor, sumar el
 * porcentaje encima no le deja a la escuela el neto exacto). Este motor usa
 * gross-up de verdad:
 *
 *     gross = (net + fixedFeeConIVA) / (1 - porcentajeConIVA)
 *
 * y es 100% configurable — nada de comisiones de marketing hardcodeadas.
 * Todo entra en centavos enteros (src/lib/money.ts): nunca floats para dinero.
 */

export type FeeAbsorptionPolicy = 'tutor_absorbs' | 'school_absorbs' | 'shared';

export interface FeeConfig {
  /** Ej. 0.035 = 3.5%. Tasa publicada por el proveedor, SIN IVA. */
  percentageFee: number;
  /** Cargo fijo por operación en centavos, SIN IVA. Ej. 300 = $3.00. */
  fixedFeeCentavos: number;
  /** Ej. 0.16 = 16% IVA sobre la comisión (no sobre el concepto). */
  vatRate: number;
  absorbedBy: FeeAbsorptionPolicy;
  /**
   * Solo cuando absorbedBy === 'shared': fracción de la comisión total que
   * paga el tutor (0..1). El resto lo absorbe la escuela. Default 0.5.
   */
  sharedTutorRatio?: number;
}

export interface FeeBreakdown {
  /** Lo que la escuela quiere recibir limpio por el concepto. */
  netCentavos: number;
  /** Comisión total (con IVA) que cobra el proveedor sobre la transacción. */
  feeCentavos: number;
  /** Lo que efectivamente paga el tutor. */
  payerTotalCentavos: number;
  /** Lo que efectivamente recibe la escuela después de la comisión. */
  schoolReceivesCentavos: number;
  policy: FeeAbsorptionPolicy;
  config: FeeConfig;
}

/**
 * Valores por default: son los que ya se usaban de facto en el MVP
 * (3.5% + $3.00 + 16% IVA ≈ la vieja fórmula 1.0406/$3.48), pero AHORA
 * correctamente aplicados con gross-up. Verificar contra las tarifas
 * vigentes publicadas por Mercado Pago antes de cobrar con dinero real —
 * esto es un default de arranque, no una tarifa contractual.
 */
export const DEFAULT_FEE_CONFIG: FeeConfig = {
  percentageFee: 0.035,
  fixedFeeCentavos: 300,
  vatRate: 0.16,
  absorbedBy: 'tutor_absorbs',
};

function percentageFeeConIva(config: FeeConfig): number {
  return config.percentageFee * (1 + config.vatRate);
}

function fixedFeeConIva(config: FeeConfig): number {
  return Math.round(config.fixedFeeCentavos * (1 + config.vatRate));
}

/** Comisión (con IVA) que cobra el proveedor sobre un monto de transacción dado. */
function calcularComisionSobre(transaccionCentavos: number, config: FeeConfig): number {
  return Math.round(transaccionCentavos * percentageFeeConIva(config) + fixedFeeConIva(config));
}

/**
 * Gross-up: cuánto hay que cobrarle al pagador para que, después de que el
 * proveedor descuente su comisión (porcentual + fija, con IVA) DE ESE MONTO,
 * a la escuela le quede exactamente `netCentavos`.
 */
export function grossUp(netCentavos: number, config: FeeConfig): number {
  const p = percentageFeeConIva(config);
  if (p >= 1) throw new Error('percentageFee configurado es >= 100% después de IVA — revisa la config.');
  const gross = (netCentavos + fixedFeeConIva(config)) / (1 - p);
  return Math.round(gross);
}

/**
 * Desglose completo listo para pintar en el checkout. `netCentavos` es
 * siempre "lo que la escuela quiere recibir por el concepto" (monto de
 * lista, con beca/descuento ya aplicado si corresponde).
 */
export function calcularDesglose(netCentavos: number, config: FeeConfig = DEFAULT_FEE_CONFIG): FeeBreakdown {
  if (netCentavos <= 0) {
    return {
      netCentavos: 0,
      feeCentavos: 0,
      payerTotalCentavos: 0,
      schoolReceivesCentavos: 0,
      policy: config.absorbedBy,
      config,
    };
  }

  switch (config.absorbedBy) {
    case 'tutor_absorbs': {
      const gross = grossUp(netCentavos, config);
      return {
        netCentavos,
        feeCentavos: gross - netCentavos,
        payerTotalCentavos: gross,
        schoolReceivesCentavos: netCentavos,
        policy: 'tutor_absorbs',
        config,
      };
    }

    case 'school_absorbs': {
      // El tutor paga exactamente el monto de lista; el proveedor descuenta
      // su comisión de ESE monto, así que la escuela recibe menos de lo
      // "limpio" — la absorbe ella, tal como pidió configurarlo.
      const fee = calcularComisionSobre(netCentavos, config);
      return {
        netCentavos,
        feeCentavos: fee,
        payerTotalCentavos: netCentavos,
        schoolReceivesCentavos: netCentavos - fee,
        policy: 'school_absorbs',
        config,
      };
    }

    case 'shared': {
      // Aproximación documentada: se calcula la comisión total como si el
      // tutor la absorbiera completa (gross-up), se reparte esa comisión
      // según sharedTutorRatio, y el tutor solo paga su parte encima del
      // monto de lista. La proporción exacta de un split "shared" depende
      // de qué tanto se le carga al tutor (la comisión real del proveedor
      // cambia con el monto de la transacción) — por eso es una
      // aproximación de negocio, no una reconciliación centavo a centavo
      // contra el proveedor.
      const ratio = config.sharedTutorRatio ?? 0.5;
      const feeSiTutorAbsorbeTodo = grossUp(netCentavos, config) - netCentavos;
      const tutorPagaExtra = Math.round(feeSiTutorAbsorbeTodo * ratio);
      const escuelaAbsorbe = feeSiTutorAbsorbeTodo - tutorPagaExtra;
      return {
        netCentavos,
        feeCentavos: feeSiTutorAbsorbeTodo,
        payerTotalCentavos: netCentavos + tutorPagaExtra,
        schoolReceivesCentavos: netCentavos - escuelaAbsorbe,
        policy: 'shared',
        config,
      };
    }
  }
}

export const ABSORPTION_LABEL: Record<FeeAbsorptionPolicy, string> = {
  tutor_absorbs: 'El tutor absorbe',
  school_absorbs: 'La escuela absorbe',
  shared: 'Se reparte',
};
