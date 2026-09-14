import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertCan, AuthorizationError } from '@/lib/rbac';
import { mercadoPagoProvider } from '@/lib/payments/factory';
import { mercadoPagoPlataformaConfigurada } from '@/config/env';
import { cifradoDisponible } from '@/lib/crypto';
import { APP_URL } from '@/lib/utils';
import type { Profile } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/integrations/mercadopago/connect
 * Redirige al owner/admin al flujo de autorización de Mercado Pago. Nunca
 * se le pide pegar un access token: solo autoriza en el sitio de MP.
 */
export async function GET() {
  if (!mercadoPagoPlataformaConfigurada()) {
    return NextResponse.json(
      { error: 'Mercado Pago no está configurado a nivel plataforma (MERCADOPAGO_CLIENT_ID/SECRET).' },
      { status: 501 },
    );
  }
  if (!cifradoDisponible()) {
    return NextResponse.json(
      { error: 'Falta INTEGRATION_ENCRYPTION_KEY — no se pueden guardar credenciales reales sin cifrado.' },
      { status: 501 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${APP_URL}/login`);

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

  const redirectUri = `${APP_URL}/api/integrations/mercadopago/callback`;
  const url = mercadoPagoProvider.createConnectionUrl!(perfil.school_id, redirectUri);
  return NextResponse.redirect(url);
}
