import 'server-only';
import crypto from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { encriptar, desencriptar } from '@/lib/crypto';
import { APP_URL } from '@/lib/utils';
import { centavosToPesos } from '@/lib/money';
import type {
  ConnectionStatus,
  CreatePaymentInput,
  PaymentIntent,
  PaymentProvider,
  PaymentStatus,
  Refund,
  WebhookEvent,
} from './types';

const MP_API = 'https://api.mercadopago.com';
// Endpoints de OAuth documentados por Mercado Pago para el flujo "Conectar
// tu cuenta" (marketplace / checkout aggregator). VERIFICAR contra la
// documentación vigente (https://www.mercadopago.com.mx/developers) antes
// de activar en producción — no se pudo confirmar en vivo desde este
// entorno, así que quedan marcados explícitamente para revisión.
const MP_AUTH_URL = 'https://auth.mercadopago.com.mx/authorization';
const MP_TOKEN_URL = `${MP_API}/oauth/token`;

/**
 * MercadoPagoProvider — implementación real de PaymentProvider.
 *
 * Requiere MERCADOPAGO_CLIENT_ID/SECRET (app de Kolek registrada en el
 * panel de desarrolladores de MP) para el flujo OAuth. Sin esas variables,
 * `getPaymentProvider()` (ver factory.ts) nunca instancia esta clase — usa
 * MockPaymentProvider en su lugar. Así nunca se intenta un cargo real sin
 * credenciales reales.
 */
export class MercadoPagoProvider implements PaymentProvider {
  readonly id = 'mercadopago' as const;
  readonly requiresConnection = true;

  createConnectionUrl(schoolId: string, redirectUri: string): string {
    const clientId = requireEnv('MERCADOPAGO_CLIENT_ID');
    const state = crypto.randomUUID();
    // El `state` se guarda para validar el callback y para saber a qué
    // escuela pertenece (MP no manda de vuelta nuestro schoolId directo).
    void persistOAuthState(state, schoolId);

    const url = new URL(MP_AUTH_URL);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('platform_id', 'mp');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchangeAuthorizationCode(schoolId: string, code: string, redirectUri: string) {
    const clientId = requireEnv('MERCADOPAGO_CLIENT_ID');
    const clientSecret = requireEnv('MERCADOPAGO_CLIENT_SECRET');

    const res = await fetch(MP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
      cache: 'no-store',
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Mercado Pago rechazó el intercambio OAuth: ${json?.message ?? res.status}`);
    }

    return {
      accessToken: json.access_token as string,
      refreshToken: (json.refresh_token as string) ?? null,
      expiresAt: json.expires_in
        ? new Date(Date.now() + Number(json.expires_in) * 1000).toISOString()
        : null,
      externalAccountId: json.user_id ? String(json.user_id) : null,
      publicKey: (json.public_key as string) ?? null,
    };
  }

  async refreshConnection(schoolId: string) {
    const clientId = requireEnv('MERCADOPAGO_CLIENT_ID');
    const clientSecret = requireEnv('MERCADOPAGO_CLIENT_SECRET');
    const conn = await getConnectionRow(schoolId);
    if (!conn?.refresh_token_encrypted) {
      throw new Error('Esta escuela no tiene refresh_token guardado.');
    }

    const res = await fetch(MP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: desencriptar(conn.refresh_token_encrypted),
      }),
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`No se pudo refrescar el token de MP: ${json?.message ?? res.status}`);

    const expiresAt = json.expires_in
      ? new Date(Date.now() + Number(json.expires_in) * 1000).toISOString()
      : null;

    const db = createAdminClient();
    await db
      .from('payment_provider_connections')
      .update({
        access_token_encrypted: encriptar(json.access_token),
        expires_at: expiresAt,
      })
      .eq('school_id', schoolId)
      .eq('provider', 'mercadopago');

    return { accessToken: json.access_token as string, expiresAt };
  }

  async disconnect(schoolId: string): Promise<void> {
    const db = createAdminClient();
    await db
      .from('payment_provider_connections')
      .update({
        status: 'disconnected',
        access_token_encrypted: null,
        refresh_token_encrypted: null,
        public_key: null,
        external_account_id: null,
      })
      .eq('school_id', schoolId)
      .eq('provider', 'mercadopago');
  }

  async getConnectionStatus(schoolId: string): Promise<ConnectionStatus> {
    const conn = await getConnectionRow(schoolId);
    return {
      connected: conn?.status === 'connected',
      externalAccountId: conn?.external_account_id ?? null,
      publicKey: conn?.public_key ?? null,
      lastError: conn?.last_error ?? null,
    };
  }

  async createCheckout(input: CreatePaymentInput): Promise<PaymentIntent> {
    const conn = await getConnectionRow(input.schoolId);
    if (!conn?.access_token_encrypted) {
      throw new Error(
        'La escuela todavía no conecta su cuenta de Mercado Pago (Ajustes › Integraciones).',
      );
    }
    const accessToken = desencriptar(conn.access_token_encrypted);

    const body: Record<string, unknown> = {
      items: [
        {
          id: input.internalPaymentId,
          title: input.titulo.slice(0, 250),
          quantity: 1,
          currency_id: 'MXN',
          unit_price: centavosToPesos(input.totalCentavos),
        },
      ],
      external_reference: input.internalPaymentId,
      statement_descriptor: 'KOLEK',
      binary_mode: true,
      back_urls: {
        success: `${input.returnUrlBase}?estado=success`,
        pending: `${input.returnUrlBase}?estado=pending`,
        failure: `${input.returnUrlBase}?estado=failure`,
      },
      auto_return: 'approved',
      notification_url: input.notificationUrl,
      metadata: { payment_id: input.internalPaymentId, origen: 'kolek' },
      ...(input.payerName || input.payerEmail
        ? {
            payer: {
              ...(input.payerName ? { name: input.payerName.slice(0, 100) } : {}),
              ...(input.payerEmail ? { email: input.payerEmail } : {}),
            },
          }
        : {}),
      ...(input.dueDate
        ? { expires: true, expiration_date_to: `${input.dueDate}T23:59:59.000-06:00` }
        : {}),
    };

    const res = await fetch(`${MP_API}/checkout/preferences`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `kolek-pref-${input.internalPaymentId}`,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Mercado Pago rechazó la preferencia (${res.status}): ${json?.message ?? 'error desconocido'}`);
    }

    return {
      providerReference: json.id,
      checkoutUrl: json.init_point ?? null,
      publicKey: conn.public_key,
      raw: json,
    };
  }

  async getPayment(providerReference: string, schoolId: string): Promise<PaymentStatus | null> {
    const conn = await getConnectionRow(schoolId);
    if (!conn?.access_token_encrypted) return null;
    const accessToken = desencriptar(conn.access_token_encrypted);

    const res = await fetch(`${MP_API}/v1/payments/${providerReference}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();

    return {
      providerReference: String(json.id),
      status: mapMpStatus(json.status),
      rawStatus: json.status,
      amountCentavos: json.transaction_amount ? Math.round(json.transaction_amount * 100) : null,
      approvedAt: json.date_approved ?? null,
    };
  }

  async validateWebhook(req: Request, rawBody: string): Promise<boolean> {
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
    if (!secret) return true; // sin secret configurado, se reconsulta contra la API (fuente de verdad)

    const xSignature = req.headers.get('x-signature');
    const xRequestId = req.headers.get('x-request-id') ?? '';
    if (!xSignature) return false;

    const partes = Object.fromEntries(
      xSignature.split(',').map((p) => {
        const [k, ...v] = p.split('=');
        return [k.trim(), v.join('=').trim()];
      }),
    );
    const dataId = new URL(req.url).searchParams.get('data.id') ?? '';
    if (!partes.ts || !partes.v1 || !dataId) return false;

    const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${partes.ts};`;
    const esperado = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(partes.v1));
    } catch {
      return false;
    }
  }

  async processWebhook(rawBody: string, req: Request): Promise<WebhookEvent> {
    const url = new URL(req.url);
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(rawBody || '{}');
    } catch {
      payload = {};
    }
    const tipo =
      (payload.type as string) || (payload.topic as string) || url.searchParams.get('type') || '';
    const dataId =
      ((payload.data as { id?: string } | undefined)?.id ?? '').toString() ||
      url.searchParams.get('data.id') ||
      '';

    return {
      eventId: dataId || crypto.randomUUID(),
      type: tipo.includes('payment') ? 'payment_update' : 'unknown',
      internalPaymentId: null, // se resuelve consultando getPayment() con el dataId
      providerReference: dataId || null,
    };
  }

  async refundPayment(providerReference: string, schoolId: string, amountCentavos?: number): Promise<Refund> {
    const conn = await getConnectionRow(schoolId);
    if (!conn?.access_token_encrypted) return { ok: false, refundedCentavos: 0 };
    const accessToken = desencriptar(conn.access_token_encrypted);

    const res = await fetch(`${MP_API}/v1/payments/${providerReference}/refunds`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: amountCentavos ? JSON.stringify({ amount: centavosToPesos(amountCentavos) }) : '{}',
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, refundedCentavos: 0, raw: json };
    return { ok: true, refundedCentavos: Math.round((json.amount ?? 0) * 100), raw: json };
  }
}

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Falta ${name} — Mercado Pago OAuth no está configurado a nivel plataforma.`);
  return v;
}

async function getConnectionRow(schoolId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from('payment_provider_connections')
    .select('*')
    .eq('school_id', schoolId)
    .eq('provider', 'mercadopago')
    .maybeSingle();
  return data;
}

/** Guarda el `state` de OAuth ligado a la escuela por unos minutos (tabla integration_events como bitácora simple). */
async function persistOAuthState(state: string, schoolId: string) {
  const db = createAdminClient();
  await db.from('integration_events').insert({
    school_id: schoolId,
    integration: 'mercadopago',
    event_type: 'oauth_state_issued',
    success: true,
    metadata: { state },
  });
}

function mapMpStatus(status: string): PaymentStatus['status'] {
  if (status === 'approved') return 'approved';
  if (status === 'refunded' || status === 'charged_back') return 'refunded';
  if (status === 'cancelled') return 'canceled';
  if (status === 'rejected') return 'rejected';
  if (status === 'in_process' || status === 'authorized') return 'processing';
  return 'pending';
}
