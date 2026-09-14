import { describe, expect, it } from 'vitest';
import { resolverMonto } from './payments';

describe('resolverMonto — prioridad de montos al generar un cargo', () => {
  it('el monto fijo del concepto siempre gana (ej. inscripción $2,500 para todos)', () => {
    expect(
      resolverMonto({ conceptoMontoFijo: 2500, alumnoMontoCustom: 1200, grupoMontoDefault: 900 }),
    ).toBe(2500);
  });

  it('sin monto fijo, el monto propio del alumno (beca/descuento) gana sobre el del grupo', () => {
    expect(resolverMonto({ conceptoMontoFijo: null, alumnoMontoCustom: 1200, grupoMontoDefault: 2450 })).toBe(1200);
  });

  it('sin monto fijo ni monto propio, usa el del grupo', () => {
    expect(resolverMonto({ conceptoMontoFijo: null, alumnoMontoCustom: null, grupoMontoDefault: 2450 })).toBe(2450);
  });

  it('un monto fijo o propio de $0 o negativo no cuenta — sigue la cadena', () => {
    expect(resolverMonto({ conceptoMontoFijo: 0, alumnoMontoCustom: null, grupoMontoDefault: 1800 })).toBe(1800);
  });
});
