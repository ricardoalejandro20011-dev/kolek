import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Abstracción de analítica. No hay proveedor externo conectado (no se
 * inventa uno) — en modo 'internal' (default) los eventos se guardan en
 * `analytics_events`, sin datos personales, solo para ver el funnel.
 * ANALYTICS_MODE=disabled apaga todo sin tocar el código que llama a track().
 */
export type AnalyticsEvent =
  | 'landing_view'
  | 'cta_demo_click'
  | 'cta_plans_click'
  | 'demo_form_start'
  | 'demo_form_submit'
  | 'registration_start'
  | 'registration_complete'
  | 'onboarding_step_complete'
  | 'onboarding_complete'
  | 'first_group_created'
  | 'first_import_completed'
  | 'first_cycle_generated'
  | 'payment_link_created'
  | 'reminder_prepared'
  | 'payment_completed'
  | 'subscription_activated'
  | 'subscription_canceled';

export async function track(
  event: AnalyticsEvent,
  properties?: Record<string, unknown>,
  schoolId?: string | null,
): Promise<void> {
  const mode = process.env.ANALYTICS_MODE ?? 'internal';
  if (mode === 'disabled') return;

  try {
    const db = createAdminClient();
    await db.from('analytics_events').insert({
      event_name: event,
      school_id: schoolId ?? null,
      properties: properties ?? null,
    });
  } catch (e) {
    console.error('[analytics] No se pudo registrar:', event, e);
  }
}
