import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { assertCan, AuthorizationError } from '@/lib/rbac';
import { evaluarAcceso, type Subscription } from '@/lib/subscriptions';
import { registrarAuditoria, ipDeRequest } from '@/lib/audit';
import type { Profile } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  payment_ids: z.array(z.string().uuid()).min(1).max(500),
  /** true = pagado en efectivo/transferencia, false = regresarlo a pendiente. */
  pagado: z.boolean().default(true),
  metodo: z.enum(['efectivo', 'transferencia', 'otro']).default('efectivo'),
  nota: z.string().max(280).optional(),
  evidencia_url: z.string().url().optional(),
});

/**
 * POST /api/payments/mark-paid
 * Registro manual de pagos en efectivo o transferencia. Queda marcado con
 * metodo_pago = 'manual' y además se guarda el detalle rico en
 * `manual_payments` (quién, cuándo, con qué método, evidencia opcional).
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
    assertCan(perfil?.role, 'payments.register_manual');
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  if (!perfil?.school_id) return NextResponse.json({ error: 'Sin escuela' }, { status: 403 });

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('school_id', perfil.school_id)
    .maybeSingle<Subscription>();
  if (!evaluarAcceso(sub).soloLecturaYExportacion && !evaluarAcceso(sub).accesoCompleto) {
    return NextResponse.json({ error: 'Tu suscripción no permite registrar pagos.' }, { status: 402 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof z.ZodError ? e.errors[0]?.message : 'Cuerpo inválido' },
      { status: 400 },
    );
  }

  const patch = body.pagado
    ? {
        status: 'pagado' as const,
        fecha_pago: new Date().toISOString(),
        metodo_pago: 'manual',
        nota_manual: body.nota ?? null,
      }
    : {
        status: 'pendiente' as const,
        fecha_pago: null,
        metodo_pago: null,
        nota_manual: body.nota ?? null,
      };

  // RLS impide tocar pagos de otra escuela aunque manden ids ajenos.
  const { data, error } = await supabase
    .from('payments')
    .update(patch)
    .in('id', body.payment_ids)
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.pagado && data?.length) {
    await supabase.from('manual_payments').insert(
      data.map((p) => ({
        school_id: perfil.school_id,
        payment_id: p.id,
        method: body.metodo,
        reference: body.nota ?? null,
        evidence_url: body.evidencia_url ?? null,
        registered_by: user.id,
        notes: body.nota ?? null,
      })),
    );
  }

  await registrarAuditoria({
    schoolId: perfil.school_id,
    userId: user.id,
    action: body.pagado ? 'payment.marked_paid_manual' : 'payment.reverted_to_pending',
    entityType: 'payment',
    entityId: body.payment_ids.join(','),
    after: { metodo: body.metodo, nota: body.nota },
    ip: ipDeRequest(req),
  });

  return NextResponse.json({ actualizados: data?.length ?? 0 });
}
