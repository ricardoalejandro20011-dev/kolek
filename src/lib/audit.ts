import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export interface AuditEntry {
  schoolId: string | null;
  userId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

/**
 * Registra una acción crítica. Nunca lanza — un fallo de auditoría no debe
 * tumbar la operación real que se está auditando (se loguea a consola como
 * último recurso). Nunca se le pasan secretos: quien llama es responsable
 * de no incluir tokens/contraseñas en `before`/`after`.
 */
export async function registrarAuditoria(entry: AuditEntry): Promise<void> {
  try {
    const db = createAdminClient();
    await db.from('audit_logs').insert({
      school_id: entry.schoolId,
      user_id: entry.userId,
      action: entry.action,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      before: entry.before ?? null,
      after: entry.after ?? null,
      ip: entry.ip ?? null,
    });
  } catch (e) {
    console.error('[audit] No se pudo registrar:', entry.action, e);
  }
}

/** IP del request, si el hosting la expone (Vercel manda x-forwarded-for). */
export function ipDeRequest(req: Request): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
}
