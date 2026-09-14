import { describe, expect, it } from 'vitest';
import { pesosToCentavos, centavosToPesos, sumCentavos, distribuirCentavos } from './money';

describe('money — todo en centavos, nunca floats', () => {
  it('pesosToCentavos redondea correctamente (evita 0.1+0.2 !== 0.3)', () => {
    expect(pesosToCentavos(2450)).toBe(245_000);
    expect(pesosToCentavos(10.1)).toBe(1010);
    expect(pesosToCentavos(0.1 + 0.2)).toBe(30); // el clásico caso roto en floats
  });

  it('centavosToPesos es la inversa exacta', () => {
    expect(centavosToPesos(245_000)).toBe(2450);
    expect(centavosToPesos(1010)).toBe(10.1);
  });

  it('centavosToPesos rechaza no-enteros (dinero nunca es fraccionario en centavos)', () => {
    expect(() => centavosToPesos(10.5)).toThrow();
  });

  it('sumCentavos nunca acumula drift de punto flotante', () => {
    const total = sumCentavos(...Array(10).fill(10)); // 10 veces $0.10
    expect(total).toBe(100);
  });

  it('distribuirCentavos reparte sin perder ni un centavo', () => {
    const partes = distribuirCentavos(100, [1, 1, 1]); // 100 centavos entre 3 partes iguales
    expect(partes.reduce((a, b) => a + b, 0)).toBe(100);
    expect(partes.length).toBe(3);
  });

  it('distribuirCentavos con pesos desiguales sigue cuadrando exacto', () => {
    const partes = distribuirCentavos(10_001, [1, 2, 7]);
    expect(partes.reduce((a, b) => a + b, 0)).toBe(10_001);
  });
});
