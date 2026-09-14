import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PLAN_POR_ID } from '@/lib/plans';
import type { SchoolPlan } from '@/lib/types';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'suspended' | 'canceled';

export interface Subscription {
  id: string;
  school_id: string;
  plan: SchoolPlan;
  billing_interval: 'monthly' | 'annual';
  status: SubscriptionStatus;
  price_centavos: number;
  onboarding_fee_centavos: number;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  grace_ends_at: string | null;
  activated_by: string | null;
  activated_at: string | null;
  canceled_at: string | null;
  notes: string | null;
}

const TRIAL_DAYS = () => Number(process.env.TRIAL_DAYS ?? 14);
const GRACE_DAYS = () => Number(process.env.SUBSCRIPTION_GRACE_DAYS ?? 7);

/** Precio mensual de cada plan, en centavos, más IVA (16%) ya calculado. */
export function precioMensualCentavos(plan: SchoolPlan): number {
  const p = PLAN_POR_ID[plan];
  const base = Math.round((p?.precio ?? 0) * 100);
  return Math.round(base * 1.16);
}

/** Plan anual = 10 mensualidades (2 meses de "regalo"), spec explícito. */
export function precioAnualCentavos(plan: SchoolPlan): number {
  return precioMensualCentavos(plan) * 10;
}

/**
 * Crea la suscripción en trial al completar el onboarding. Idempotente:
 * si ya existe, no la toca.
 */
export async function asegurarSuscripcionTrial(
  db: SupabaseClient,
  schoolId: string,
  plan: SchoolPlan,
): Promise<void> {
  const { data: existente } = await db
    .from('subscriptions')
    .select('id')
    .eq('school_id', schoolId)
    .maybeSingle();
  if (existente) return;

  const ahora = new Date();
  const trialEnds = new Date(ahora.getTime() + TRIAL_DAYS() * 86_400_000);

  await db.from('subscriptions').insert({
    school_id: schoolId,
    plan,
    status: 'trialing',
    price_centavos: precioMensualCentavos(plan),
    trial_ends_at: trialEnds.toISOString(),
    current_period_start: ahora.toISOString(),
    current_period_end: trialEnds.toISOString(),
  });
}

export interface AccesoResultado {
  /** Puede usar la app normalmente (generar ciclos, escribir datos). */
  accesoCompleto: boolean;
  /** Puede al menos consultar y exportar (periodo de gracia post-vencimiento). */
  soloLecturaYExportacion: boolean;
  motivo: string | null;
}

/**
 * Regla de negocio: trialing/active = acceso completo. past_due/suspended
 * dentro del periodo de gracia = solo lectura + exportación (NUNCA generar
 * cargos nuevos). Fuera de gracia, o canceled = bloqueado del todo.
 */
export function evaluarAcceso(sub: Subscription | null): AccesoResultado {
  if (!sub) {
    return { accesoCompleto: false, soloLecturaYExportacion: false, motivo: 'Sin suscripción' };
  }

  if (sub.status === 'trialing' || sub.status === 'active') {
    return { accesoCompleto: true, soloLecturaYExportacion: true, motivo: null };
  }

  if (sub.status === 'past_due' || sub.status === 'suspended') {
    const graceEnds = sub.grace_ends_at ? new Date(sub.grace_ends_at) : null;
    const dentroDeGracia = graceEnds ? new Date() < graceEnds : false;
    if (dentroDeGracia) {
      return {
        accesoCompleto: false,
        soloLecturaYExportacion: true,
        motivo: 'Suscripción vencida — periodo de gracia: solo lectura y exportación.',
      };
    }
    return {
      accesoCompleto: false,
      soloLecturaYExportacion: false,
      motivo: 'Suscripción vencida y el periodo de gracia terminó.',
    };
  }

  // canceled
  return { accesoCompleto: false, soloLecturaYExportacion: false, motivo: 'Suscripción cancelada.' };
}

/** Al vencer, calcula hasta cuándo dura la gracia (para grace_ends_at). */
export function calcularFinDeGracia(desde = new Date()): string {
  return new Date(desde.getTime() + GRACE_DAYS() * 86_400_000).toISOString();
}

/** ¿La escuela ya rebasó el límite de alumnos activos de su plan? */
export function excedeLimiteAlumnos(plan: SchoolPlan, alumnosActivos: number): boolean {
  const p = PLAN_POR_ID[plan];
  if (!p) return false;
  return alumnosActivos > p.limite;
}
