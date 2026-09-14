import { describe, expect, it } from 'vitest';
import { evaluarAcceso, excedeLimiteAlumnos, precioMensualCentavos, precioAnualCentavos, type Subscription } from './subscriptions';

function sub(overrides: Partial<Subscription>): Subscription {
  return {
    id: 's1',
    school_id: 'esc1',
    plan: 'crecimiento',
    billing_interval: 'monthly',
    status: 'trialing',
    price_centavos: 0,
    onboarding_fee_centavos: 0,
    trial_ends_at: null,
    current_period_start: null,
    current_period_end: null,
    grace_ends_at: null,
    activated_by: null,
    activated_at: null,
    canceled_at: null,
    notes: null,
    ...overrides,
  };
}

describe('Estados de suscripción — evaluarAcceso', () => {
  it('trialing y active tienen acceso completo', () => {
    expect(evaluarAcceso(sub({ status: 'trialing' })).accesoCompleto).toBe(true);
    expect(evaluarAcceso(sub({ status: 'active' })).accesoCompleto).toBe(true);
  });

  it('past_due DENTRO del periodo de gracia: solo lectura, sin generar cargos', () => {
    const manana = new Date(Date.now() + 86_400_000).toISOString();
    const r = evaluarAcceso(sub({ status: 'past_due', grace_ends_at: manana }));
    expect(r.accesoCompleto).toBe(false);
    expect(r.soloLecturaYExportacion).toBe(true);
  });

  it('past_due FUERA del periodo de gracia: bloqueado del todo', () => {
    const ayer = new Date(Date.now() - 86_400_000).toISOString();
    const r = evaluarAcceso(sub({ status: 'past_due', grace_ends_at: ayer }));
    expect(r.accesoCompleto).toBe(false);
    expect(r.soloLecturaYExportacion).toBe(false);
  });

  it('suspended sin grace_ends_at se trata como fuera de gracia', () => {
    const r = evaluarAcceso(sub({ status: 'suspended', grace_ends_at: null }));
    expect(r.accesoCompleto).toBe(false);
    expect(r.soloLecturaYExportacion).toBe(false);
  });

  it('canceled siempre bloqueado', () => {
    const r = evaluarAcceso(sub({ status: 'canceled' }));
    expect(r.accesoCompleto).toBe(false);
    expect(r.soloLecturaYExportacion).toBe(false);
  });

  it('sin suscripción, bloqueado', () => {
    const r = evaluarAcceso(null);
    expect(r.accesoCompleto).toBe(false);
  });
});

describe('Límites de plan', () => {
  it('detecta cuando una escuela excede el límite de alumnos de su plan', () => {
    expect(excedeLimiteAlumnos('inicio', 81)).toBe(true); // Mini: 80
    expect(excedeLimiteAlumnos('inicio', 80)).toBe(false);
    expect(excedeLimiteAlumnos('crecimiento', 301)).toBe(true); // Escuela: 300
    expect(excedeLimiteAlumnos('pro', 700)).toBe(false); // Pro: 700
  });
});

describe('Precios de suscripción', () => {
  it('el precio anual es exactamente 10 mensualidades (spec: 2 meses de regalo)', () => {
    const mensual = precioMensualCentavos('crecimiento');
    expect(precioAnualCentavos('crecimiento')).toBe(mensual * 10);
  });

  it('el precio mensual incluye el 16% de IVA', () => {
    // Mini: $790 + IVA
    expect(precioMensualCentavos('inicio')).toBe(Math.round(79_000 * 1.16));
  });
});
