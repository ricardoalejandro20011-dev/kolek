import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { mercadoPagoProvider } from '@/lib/payments/factory';
import { encriptar } from '@/lib/crypto';
import { registrarAuditoria } from '@/lib/audit';
import { APP_URL } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/integrations/mercadopago/callback?code=...&state=...
 * Mercado Pago manda de vuelta aquí después de que el owner autoriza.
 * `state` es el uuid que generamos en /connect y guardamos en
 * integration_events — así sabemos a qué escuela pertenece este callback
 * sin confiar en nada que el navegador pudiera manipular.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  const destino = `${APP_URL}/dashboard/settings?tab=integraciones`;

  if (errorParam || !code || !state) {
    return NextResponse.redirect(`${destino}&mp_error=${encodeURIComponent(errorParam ?? 'faltan parámetros')}`);
  }

  const db = createAdminClient();
  const { data: evento } = await db
    .from('integration_events')
    .select('school_id')
    .eq('integration', 'mercadopago')
    .eq('event_type', 'oauth_state_issued')
    .contains('metadata', { state })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const schoolId = evento?.school_id;
  if (!schoolId) {
    return NextResponse.redirect(`${destino}&mp_error=state_invalido_o_expirado`);
  }

  try {
    const redirectUri = `${APP_URL}/api/integrations/mercadopago/callback`;
    const tokens = await mercadoPagoProvider.exchangeAuthorizationCode!(schoolId, code, redirectUri);

    await db.from('payment_provider_connections').upsert(
      {
        school_id: schoolId,
        provider: 'mercadopago',
        status: 'connected',
        external_account_id: tokens.externalAccountId,
        access_token_encrypted: encriptar(tokens.accessToken),
        refresh_token_encrypted: tokens.refreshToken ? encriptar(tokens.refreshToken) : null,
        public_key: tokens.publicKey,
        expires_at: tokens.expiresAt,
        connected_at: new Date().toISOString(),
        last_error: null,
      },
      { onConflict: 'school_id,provider' },
    );

    await registrarAuditoria({
      schoolId,
      userId: null,
      action: 'integration.mercadopago_connected',
      entityType: 'payment_provider_connection',
    });

    return NextResponse.redirect(`${destino}&mp_conectado=1`);
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : 'Error desconocido';
    await db.from('payment_provider_connections').upsert(
      { school_id: schoolId, provider: 'mercadopago', status: 'error', last_error: mensaje },
      { onConflict: 'school_id,provider' },
    );
    return NextResponse.redirect(`${destino}&mp_error=${encodeURIComponent(mensaje)}`);
  }
}
