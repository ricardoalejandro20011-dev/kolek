import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { assertCan, AuthorizationError } from '@/lib/rbac';
import { precioMensualCentavos, precioAnualCentavos } from '@/lib/subscriptions';
import { registrarAuditoria, ipDeRequest } from '@/lib/audit';
import type { Profile, SchoolPlan } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  plan: z.enum(['inicio', 'crecimiento', 'pro']),
  billing_interval: z.enum(['monthly', 'annual']).default('monthly'),
});

/**
 * POST /api/subscription/change-plan
 *
 * Único camino para cambiar de plan — nunca un UPDATE directo del cliente a
 * `schools.plan` ni a `subscriptions`. Así queda auditado y `schools.plan`
 * (que el resto de la UI ya lee) y `subscriptions.plan` (la fuente de
 * verdad de facturación) nunca se desincronizan.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: perfil } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<Profile>();

  try {
    assertCan(perfil?.role, 'school.billing');
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }
  if (!perfil?.school_id) return NextResponse.json({ error: 'Sin escuela' }, { status: 403 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof z.ZodError ? e.errors[0]?.message : 'Cuerpo inválido' },
      { status: 400 },
    );
  }

  const plan = body.plan as SchoolPlan;
  const precio =
    body.billing_interval === 'annual' ? precioAnualCentavos(plan) : precioMensualCentavos(plan);

  const admin = createAdminClient();

  const { data: subAntes } = await admin
    .from('subscriptions')
    .select('*')
    .eq('school_id', perfil.school_id)
    .maybeSingle();

  // Cambiar de plan NUNCA borra historial: solo actualiza el registro
  // vigente. El antes/después queda en audit_logs.
  const { error: errSub } = await admin
    .from('subscriptions')
    .update({ plan, billing_interval: body.billing_interval, price_centavos: precio })
    .eq('school_id', perfil.school_id);

  const { error: errSchool } = await admin
    .from('schools')
    .update({ plan })
    .eq('id', perfil.school_id);

  if (errSub || errSchool) {
    return NextResponse.json({ error: (errSub ?? errSchool)?.message }, { status: 500 });
  }

  await registrarAuditoria({
    schoolId: perfil.school_id,
    userId: user.id,
    action: 'subscription.plan_changed',
    entityType: 'subscription',
    before: { plan: subAntes?.plan },
    after: { plan, billing_interval: body.billing_interval },
    ip: ipDeRequest(req),
  });

  return NextResponse.json({ ok: true, plan, price_centavos: precio });
}
