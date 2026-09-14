import 'server-only';

/**
 * ── RBAC ─────────────────────────────────────────────────────────────────
 * Cuatro roles. La autorización vive en el SERVIDOR (esta función, llamada
 * desde route handlers y server actions) — ocultar un botón en el cliente
 * no es autorización, es decoración. RLS en Postgres es la última línea de
 * defensa (aislamiento por escuela); esto es la política de QUÉ puede hacer
 * cada rol DENTRO de su propia escuela.
 *
 * Compatibilidad: el esquema original (Colekta MVP) solo tenía
 * owner/admin/staff. `normalizeRole` traduce esos valores heredados a los
 * cuatro roles nuevos para que ninguna cuenta existente quede huérfana.
 */

export type Role = 'owner' | 'administrator' | 'collections' | 'viewer';
/** Valor crudo tal como puede venir de la columna profiles.role (nuevo o heredado). */
export type RawRole = Role | 'admin' | 'staff';

export function normalizeRole(raw: RawRole | string | null | undefined): Role {
  switch (raw) {
    case 'owner':
      return 'owner';
    case 'administrator':
    case 'admin': // heredado del esquema MVP
      return 'administrator';
    case 'collections':
    case 'staff': // heredado del esquema MVP
      return 'collections';
    case 'viewer':
      return 'viewer';
    default:
      // Cuenta sin rol reconocible: el default más seguro es solo-lectura.
      return 'viewer';
  }
}

export type Permission =
  | 'school.configure' // datos de la escuela, calendario de cobranza
  | 'school.billing' // plan de Kolek, suscripción
  | 'integrations.manage' // conectar/desconectar proveedores de pago y WhatsApp
  | 'users.manage' // invitar / quitar usuarios, cambiar roles
  | 'students.write' // crear/editar/borrar alumnos, tutores, grupos
  | 'students.read'
  | 'concepts.write'
  | 'charges.generate' // generar ciclos de cobro
  | 'charges.cancel'
  | 'payments.register_manual' // registrar pago en efectivo/transferencia
  | 'payments.read'
  | 'reminders.send'
  | 'notes.write'
  | 'reports.export'
  | 'audit.read';

const MATRIZ: Record<Role, Permission[]> = {
  owner: [
    'school.configure',
    'school.billing',
    'integrations.manage',
    'users.manage',
    'students.write',
    'students.read',
    'concepts.write',
    'charges.generate',
    'charges.cancel',
    'payments.register_manual',
    'payments.read',
    'reminders.send',
    'notes.write',
    'reports.export',
    'audit.read',
  ],
  administrator: [
    'students.write',
    'students.read',
    'concepts.write',
    'charges.generate',
    'charges.cancel',
    'payments.register_manual',
    'payments.read',
    'reminders.send',
    'notes.write',
    'reports.export',
    'audit.read',
  ],
  collections: [
    'students.read',
    'payments.read',
    'payments.register_manual',
    'reminders.send',
    'notes.write',
  ],
  viewer: ['students.read', 'payments.read'],
};

export function can(role: RawRole | string | null | undefined, permiso: Permission): boolean {
  return MATRIZ[normalizeRole(role)].includes(permiso);
}

/** Lanza un Error legible si el rol no tiene el permiso — para usar en route handlers. */
export function assertCan(role: RawRole | string | null | undefined, permiso: Permission): void {
  if (!can(role, permiso)) {
    throw new AuthorizationError(
      `Tu rol (${normalizeRole(role)}) no tiene permiso para: ${permiso}`,
    );
  }
}

export class AuthorizationError extends Error {
  readonly status = 403;
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Dueño',
  administrator: 'Administrador',
  collections: 'Cobranza',
  viewer: 'Solo lectura',
};
