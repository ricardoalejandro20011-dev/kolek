import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { mercadoPagoProvider } from '@/lib/payments/factory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/mercadopago?school=<uuid>
 *
 * Mercado Pago manda solo el id del pago; lo consultamos contra su API con
 * el access_token de la escuela dueña de la preference y conciliamos el
 * registro en `payments` por external_reference.
 *
 * Idempotencia real: cada evento se guarda en `webhook_events` con
 * unique(provider, event_id) ANTES de procesarlo. Si MP reintenta el mismo
 * evento (común: lo hace varias veces hasta recibir 200), la segunda vez se
 * detecta y se responde 200 sin volver a tocar `payments`.
 *
 * Siempre respondemos 200 salvo error nuestro: un 4xx hace que MP reintente
 * durante días por algo que nunca se va a arreglar solo.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const db = createAdminClient();

  const event = await mercadoPagoProvider.processWebhook(rawBody, req);

  if (event.type !== 'payment_update' || !event.eventId) {
    return NextResponse.json({ ignorado: true }, { status: 200 });
  }

  if (!(await mercadoPagoProvider.validateWebhook(req, rawBody))) {
    console.warn('[mercadopago] Firma inválida para el pago', event.eventId);
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
  }

  // ── Idempotencia: ¿ya procesamos este evento? ──────────────────────
  const { data: yaExiste } = await db
    .from('webhook_events')
    .select('id, processed_at')
    .eq('provider', 'mercadopago')
    .eq('event_id', event.eventId)
    .maybeSingle();

  if (yaExiste?.processed_at) {
    return NextResponse.json({ ok: true, idempotente: true });
  }

  if (!yaExiste) {
    await db.from('webhook_events').insert({
      provider: 'mercadopago',
      event_id: event.eventId,
      payload: safeJson(rawBody),
    });
  }

  const schoolId = new URL(req.url).searchParams.get('school');
  if (!schoolId) {
    await marcarWebhook(db, event.eventId, 'ignorado: sin school en la URL');
    return NextResponse.json({ ignorado: true }, { status: 200 });
  }

  const dataId = event.providerReference;
  if (!dataId) {
    await marcarWebhook(db, event.eventId, 'ignorado: sin data.id');
    return NextResponse.json({ ignorado: true }, { status: 200 });
  }

  const pagoMp = await mercadoPagoProvider.getPayment(dataId, schoolId);
  if (!pagoMp) {
    await incrementarIntento(db, event.eventId, 'no se pudo consultar el pago en MP');
    return NextResponse.json({ error: 'Pago no consultable' }, { status: 200 });
  }

  const paymentId = await resolverExternalReference(db, dataId, schoolId);
  if (!paymentId) {
    await marcarWebhook(db, event.eventId, 'external_reference sin pago local');
    return NextResponse.json({ ignorado: true }, { status: 200 });
  }

  const nuevoStatus = mapEstado(pagoMp.status);
  const patch: Record<string, unknown> = {
    mp_payment_id: dataId,
    mp_status: pagoMp.rawStatus,
    status: nuevoStatus,
    metodo_pago: 'mercado_pago',
  };
  if (nuevoStatus === 'pagado') patch.fecha_pago = pagoMp.approvedAt ?? new Date().toISOString();

  const { data: actualizado, error } = await db
    .from('payments')
    .update(patch)
    .eq('id', paymentId)
    .select('id, status, ciclo, school_id')
    .maybeSingle();

  await db
    .from('payment_attempts')
    .update({ status: pagoMp.status, raw_status: pagoMp.rawStatus })
    .eq('payment_id', paymentId)
    .eq('provider', 'mercadopago');

  if (error) {
    console.error('[mercadopago] Error al conciliar', paymentId, error.message);
    await incrementarIntento(db, event.eventId, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!actualizado) {
    await marcarWebhook(db, event.eventId, 'update sin filas afectadas');
    return NextResponse.json({ ignorado: true }, { status: 200 });
  }

  await db
    .from('webhook_events')
    .update({ processed_at: new Date().toISOString(), result: `ok:${nuevoStatus}` })
    .eq('provider', 'mercadopago')
    .eq('event_id', event.eventId);

  console.info(`[mercadopago] Pago ${paymentId} → ${pagoMp.rawStatus} (${nuevoStatus})`);
  return NextResponse.json({ ok: true, payment_id: paymentId, status: nuevoStatus });
}

/** MP a veces pega un GET para verificar que la URL responde. */
export async function GET() {
  return NextResponse.json({ ok: true, servicio: 'kolek-mercadopago-webhook' });
}

function mapEstado(status: string): 'pagado' | 'pendiente' | 'procesando' | 'cancelado' | 'reembolsado' {
  if (status === 'approved') return 'pagado';
  if (status === 'refunded') return 'reembolsado';
  if (status === 'cancelled') return 'cancelado';
  if (status === 'processing') return 'procesando';
  return 'pendiente';
}

async function resolverExternalReference(
  db: ReturnType<typeof createAdminClient>,
  dataId: string,
  schoolId: string,
): Promise<string | null> {
  // El payment_attempts que ya creamos al generar el checkout es la forma
  // confiable de mapear provider_reference → payments.id sin depender de
  // parsear external_reference del payload crudo (que no guardamos aquí).
  const { data } = await db
    .from('payment_attempts')
    .select('payment_id')
    .eq('provider', 'mercadopago')
    .eq('school_id', schoolId)
    .eq('provider_reference', dataId)
    .maybeSingle();
  return data?.payment_id ?? null;
}

async function marcarWebhook(db: ReturnType<typeof createAdminClient>, eventId: string, resultado: string) {
  await db
    .from('webhook_events')
    .update({ processed_at: new Date().toISOString(), result: resultado })
    .eq('provider', 'mercadopago')
    .eq('event_id', eventId);
}

async function incrementarIntento(db: ReturnType<typeof createAdminClient>, eventId: string, error: string) {
  const { data } = await db
    .from('webhook_events')
    .select('attempts')
    .eq('provider', 'mercadopago')
    .eq('event_id', eventId)
    .maybeSingle();
  await db
    .from('webhook_events')
    .update({ attempts: (data?.attempts ?? 0) + 1, error })
    .eq('provider', 'mercadopago')
    .eq('event_id', eventId);
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
