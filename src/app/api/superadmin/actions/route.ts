import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperadmin } from '@/lib/superadmin';
import { createAdminClient } from '@/lib/supabase/admin';
import { calcularFinDeGracia, precioMensualCentavos } from '@/lib/subscriptions';
import { registrarAuditoria, ipDeRequest } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.discriminatedUnion('accion', [
  z.object({ accion: z.literal('activar'), school_id: z.string().uuid() }),
  z.object({ accion: z.literal('suspender'), school_id: z.string().uuid() }),
  z.object({
    accion: z.literal('cambiar_plan'),
    school_id: z.string().uuid(),
    plan: z.enum(['inicio', 'crecimiento', 'pro']),
  }),
  z.object({ accion: z.literal('extender_prueba'), school_id: z.string().uuid(), dias: z.number().int().min(1).max(90) }),
  z.object({ accion: z.literal('reintentar_webhook'), event_id: z.string(), provider: z.string() }),
]);

/**
 * POST /api/superadmin/actions
 *
 * Todas las intervenciones del panel interno pasan por aquí — nunca un
 * UPDATE directo desde la UI. Cada una queda en audit_logs. El superadmin
 * NUNCA modifica pagos de una escuela en silencio: estas acciones son solo
 * sobre la relación de suscripción/plataforma, no sobre el dinero de las
 * colegiaturas.
 */
export async function POST(req: Request) {
  const { userId } = await requireSuperadmin();
  const db = createAdminClient();

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof z.ZodError ? e.errors[0]?.message : 'Cuerpo inválido' },
      { status: 400 },
    );
  }

  if (body.accion === 'reintentar_webhook') {
    const { data: evento } = await db
      .from('webhook_events')
      .select('*')
      .eq('provider', body.provider)
      .eq('event_id', body.event_id)
      .maybeSingle();
    if (!evento) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });

    await db
      .from('webhook_events')
      .update({ processed_at: null, error: null })
      .eq('provider', body.provider)
      .eq('event_id', body.event_id);

    await registrarAuditoria({
      schoolId: null,
      userId,
      action: 'superadmin.webhook_retry_flagged',
      entityType: 'webhook_event',
      entityId: body.event_id,
    });
    return NextResponse.json({ ok: true, nota: 'Marcado para reproceso en el próximo webhook entrante.' });
  }

  const { data: subAntes } = await db
    .from('subscriptions')
    .select('*')
    .eq('school_id', body.school_id)
    .maybeSingle();

  let patch: Record<string, unknown> = {};
  let accionLog = '';

  switch (body.accion) {
    case 'activar': {
      const ahora = new Date();
      const periodoFin = new Date(ahora.getTime() + 30 * 86_400_000);
      patch = {
        status: 'active',
        activated_by: userId,
        activated_at: ahora.toISOString(),
        current_period_start: ahora.toISOString(),
        current_period_end: periodoFin.toISOString(),
        grace_ends_at: null,
      };
      accionLog = 'superadmin.subscription_activated';
      break;
    }
    case 'suspender': {
      patch = { status: 'suspended', grace_ends_at: calcularFinDeGracia() };
      accionLog = 'superadmin.subscription_suspended';
      break;
    }
    case 'cambiar_plan': {
      patch = { plan: body.plan, price_centavos: precioMensualCentavos(body.plan) };
      await db.from('schools').update({ plan: body.plan }).eq('id', body.school_id);
      accionLog = 'superadmin.plan_changed';
      break;
    }
    case 'extender_prueba': {
      const base = subAntes?.trial_ends_at ? new Date(subAntes.trial_ends_at) : new Date();
      const nuevaFecha = new Date(base.getTime() + body.dias * 86_400_000);
      patch = { trial_ends_at: nuevaFecha.toISOString(), status: 'trialing' };
      accionLog = 'superadmin.trial_extended';
      break;
    }
  }

  const { error } = await db.from('subscriptions').update(patch).eq('school_id', body.school_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await registrarAuditoria({
    schoolId: body.school_id,
    userId,
    action: accionLog,
    entityType: 'subscription',
    before: subAntes,
    after: patch,
    ip: ipDeRequest(req),
  });

  return NextResponse.json({ ok: true });
}
