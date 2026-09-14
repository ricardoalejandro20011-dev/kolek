import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { asegurarSuscripcionTrial } from '@/lib/subscriptions';
import { registrarAuditoria, ipDeRequest } from '@/lib/audit';
import type { Profile, School } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ dia_vencimiento: z.number().int().min(1).max(28) });

/**
 * POST /api/onboarding/complete
 *
 * Marca la escuela como lista Y arranca su periodo de prueba (subscriptions
 * en 'trialing', TRIAL_DAYS días). El cliente no puede insertar en
 * `subscriptions` directo (sin policy de INSERT a propósito) — el estado de
 * la suscripción de Kolek solo lo escribe el servidor.
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

  const { data: school, error } = await supabase
    .from('schools')
    .update({ onboarding_completo: true, dia_vencimiento: body.dia_vencimiento })
    .eq('id', perfil.school_id)
    .select()
    .maybeSingle<School>();

  if (error || !school) {
    return NextResponse.json({ error: error?.message ?? 'No se pudo completar el onboarding' }, { status: 500 });
  }

  const admin = createAdminClient();
  await asegurarSuscripcionTrial(admin, school.id, school.plan);

  await registrarAuditoria({
    schoolId: school.id,
    userId: user.id,
    action: 'onboarding.completed',
    entityType: 'school',
    entityId: school.id,
    ip: ipDeRequest(req),
  });

  return NextResponse.json({ ok: true });
}
