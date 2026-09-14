import { describe, expect, it } from 'vitest';
import { calcularDesglose, grossUp, DEFAULT_FEE_CONFIG, type FeeConfig } from './fee-engine';

const CONFIG_2450 = DEFAULT_FEE_CONFIG; // 3.5% + $3.00 + 16% IVA, tutor_absorbs

describe('PaymentFeeEngine — gross-up', () => {
  it('tutor_absorbs: la escuela recibe EXACTAMENTE el neto, sin importar la comisión', () => {
    const netoCentavos = 245_000; // $2,450.00
    const d = calcularDesglose(netoCentavos, CONFIG_2450);

    expect(d.schoolReceivesCentavos).toBe(netoCentavos);
    // El tutor paga más que el neto (absorbe la comisión completa).
    expect(d.payerTotalCentavos).toBeGreaterThan(netoCentavos);
    // La comisión declarada es justo la diferencia entre lo que paga el
    // tutor y lo que recibe la escuela.
    expect(d.payerTotalCentavos - d.feeCentavos).toBe(netoCentavos);
  });

  it('grossUp es la inversa exacta de aplicar la comisión sobre el resultado', () => {
    const netoCentavos = 245_000;
    const gross = grossUp(netoCentavos, CONFIG_2450);
    const p = CONFIG_2450.percentageFee * (1 + CONFIG_2450.vatRate);
    const fixedConIva = Math.round(CONFIG_2450.fixedFeeCentavos * (1 + CONFIG_2450.vatRate));
    const netoReconstruido = Math.round(gross - (gross * p + fixedConIva));
    // Con enteros puede haber +-1 centavo de redondeo, nunca más.
    expect(Math.abs(netoReconstruido - netoCentavos)).toBeLessThanOrEqual(1);
  });

  it('school_absorbs: el tutor paga exactamente el monto de lista', () => {
    const netoCentavos = 245_000;
    const config: FeeConfig = { ...CONFIG_2450, absorbedBy: 'school_absorbs' };
    const d = calcularDesglose(netoCentavos, config);

    expect(d.payerTotalCentavos).toBe(netoCentavos);
    expect(d.schoolReceivesCentavos).toBeLessThan(netoCentavos);
    expect(d.schoolReceivesCentavos + d.feeCentavos).toBe(netoCentavos);
  });

  it('shared 50/50: el tutor paga más que el neto pero menos que el gross-up completo', () => {
    const netoCentavos = 245_000;
    const config: FeeConfig = { ...CONFIG_2450, absorbedBy: 'shared', sharedTutorRatio: 0.5 };
    const d = calcularDesglose(netoCentavos, config);
    const grossCompleto = grossUp(netoCentavos, CONFIG_2450);

    expect(d.payerTotalCentavos).toBeGreaterThan(netoCentavos);
    expect(d.payerTotalCentavos).toBeLessThan(grossCompleto);
    // La escuela recibe menos que el neto completo (absorbe su mitad).
    expect(d.schoolReceivesCentavos).toBeLessThan(netoCentavos);
    expect(d.schoolReceivesCentavos).toBeGreaterThan(0);
  });

  it('redondea siempre a centavos enteros', () => {
    const d = calcularDesglose(333_33, CONFIG_2450); // monto "feo" a propósito
    expect(Number.isInteger(d.feeCentavos)).toBe(true);
    expect(Number.isInteger(d.payerTotalCentavos)).toBe(true);
    expect(Number.isInteger(d.schoolReceivesCentavos)).toBe(true);
  });

  it('monto cero o negativo no genera comisión ni total', () => {
    expect(calcularDesglose(0, CONFIG_2450).payerTotalCentavos).toBe(0);
    expect(calcularDesglose(-100, CONFIG_2450).payerTotalCentavos).toBe(0);
  });
});
