import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertCan, AuthorizationError } from '@/lib/rbac';
import { mercadoPagoProvider } from '@/lib/payments/factory';
import { registrarAuditoria, ipDeRequest } from '@/lib/audit';
import type { Profile } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    assertCan(perfil?.role, 'integrations.manage');
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }
  if (!perfil?.school_id) return NextResponse.json({ error: 'Sin escuela' }, { status: 403 });

  await mercadoPagoProvider.disconnect!(perfil.school_id);
  await registrarAuditoria({
    schoolId: perfil.school_id,
    userId: user.id,
    action: 'integration.mercadopago_disconnected',
    entityType: 'payment_provider_connection',
    ip: ipDeRequest(req),
  });

  return NextResponse.json({ ok: true });
}
