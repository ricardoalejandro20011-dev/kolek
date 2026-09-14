import { describe, expect, it } from 'vitest';
import { can, normalizeRole, assertCan, AuthorizationError } from './rbac';

describe('RBAC — permisos por rol', () => {
  it('normaliza roles heredados del esquema MVP (admin/staff)', () => {
    expect(normalizeRole('admin')).toBe('administrator');
    expect(normalizeRole('staff')).toBe('collections');
    expect(normalizeRole('owner')).toBe('owner');
    expect(normalizeRole('viewer')).toBe('viewer');
  });

  it('un rol desconocido cae a "viewer" (el más restrictivo), nunca a admin', () => {
    expect(normalizeRole('lo-que-sea')).toBe('viewer');
    expect(normalizeRole(null)).toBe('viewer');
    expect(normalizeRole(undefined)).toBe('viewer');
  });

  it('owner puede todo lo crítico', () => {
    expect(can('owner', 'integrations.manage')).toBe(true);
    expect(can('owner', 'users.manage')).toBe(true);
    expect(can('owner', 'school.billing')).toBe(true);
    expect(can('owner', 'audit.read')).toBe(true);
  });

  it('administrator puede operar cobranza pero NO integraciones ni plan', () => {
    expect(can('administrator', 'charges.generate')).toBe(true);
    expect(can('administrator', 'payments.register_manual')).toBe(true);
    expect(can('administrator', 'integrations.manage')).toBe(false);
    expect(can('administrator', 'school.billing')).toBe(false);
    expect(can('administrator', 'users.manage')).toBe(false);
  });

  it('collections puede cobrar y anotar pero no generar ciclos ni exportar', () => {
    expect(can('collections', 'payments.register_manual')).toBe(true);
    expect(can('collections', 'reminders.send')).toBe(true);
    expect(can('collections', 'charges.generate')).toBe(false);
    expect(can('collections', 'reports.export')).toBe(false);
    expect(can('collections', 'integrations.manage')).toBe(false);
  });

  it('viewer es estrictamente solo lectura', () => {
    expect(can('viewer', 'students.read')).toBe(true);
    expect(can('viewer', 'payments.read')).toBe(true);
    expect(can('viewer', 'students.write')).toBe(false);
    expect(can('viewer', 'payments.register_manual')).toBe(false);
    expect(can('viewer', 'charges.generate')).toBe(false);
  });

  it('assertCan lanza AuthorizationError (403) cuando no hay permiso', () => {
    expect(() => assertCan('viewer', 'charges.generate')).toThrow(AuthorizationError);
    expect(() => assertCan('owner', 'charges.generate')).not.toThrow();
  });
});
