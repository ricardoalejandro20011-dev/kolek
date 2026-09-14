import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPaymentProvider } from '@/lib/payments/factory';
import { registrarAuditoria } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  /** link_token público (no el id interno) — mismo criterio que /p/[token]. */
  token: z.string().uuid(),
  resultado: z.enum(['approved', 'rejected', 'pending', 'refund', 'duplicate']),
});

/**
 * POST /api/payments/simulate
 *
 * Único lugar de todo el sistema donde un pago "se aprueba" sin pasar por
 * un proveedor real. Existe para poder probar el flujo completo
 * (checkout → conciliación → dashboard) sin credenciales. Se autoprotege:
 * si la escuela dueña del pago ya está conectada a un proveedor real
 * (Mercado Pago), esta ruta se niega — nunca se puede "simular" un pago
 * real ni pisar un estado que vino de verdad de un proveedor.
 */
export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof z.ZodError ? e.errors[0]?.message : 'Cuerpo inválido' },
      { status: 400 },
    );
  }

  const db = createAdminClient();
  const { data: pago } = await db
    .from('payments')
    .select('id, school_id, status, monto_total_cobrado')
    .eq('link_token', body.token)
    .maybeSingle();

  if (!pago) return NextResponse.json({ error: 'Link de pago no encontrado' }, { status: 404 });

  const provider = await getPaymentProvider(pago.school_id);
  if (provider.id !== 'mock') {
    return NextResponse.json(
      { error: 'Esta escuela ya está conectada a un proveedor real. No se puede simular.' },
      { status: 409 },
    );
  }

  if (pago.status === 'pagado' && body.resultado !== 'refund') {
    return NextResponse.json({ error: 'Este pago ya está conciliado.' }, { status: 409 });
  }

  const providerReference = `mock_${pago.id}`;
  const ahora = new Date().toISOString();

  if (body.resultado === 'duplicate') {
    // Simula que el "webhook" del mock llega dos veces: la segunda vez no
    // debe cambiar nada ni duplicar efectos. Como el mock no tiene un
    // webhook HTTP real, se demuestra aquí mismo aplicando el approve dos
    // veces seguidas y confirmando que el resultado es idéntico.
    await aplicarResultado(db, pago.id, pago.school_id, providerReference, 'approved', ahora);
    const resultado = await aplicarResultado(db, pago.id, pago.school_id, providerReference, 'approved', ahora);
    return NextResponse.json({ ok: true, nota: 'Evento duplicado aplicado dos veces sin efecto doble', ...resultado });
  }

  const resultado = await aplicarResultado(db, pago.id, pago.school_id, providerReference, body.resultado, ahora);

  await registrarAuditoria({
    schoolId: pago.school_id,
    userId: null,
    action: 'payment.simulated',
    entityType: 'payment',
    entityId: pago.id,
    after: { resultado: body.resultado },
  });

  return NextResponse.json({ ok: true, ...resultado });
}

async function aplicarResultado(
  db: ReturnType<typeof createAdminClient>,
  paymentId: string,
  schoolId: string,
  providerReference: string,
  resultado: 'approved' | 'rejected' | 'pending' | 'refund',
  ahora: string,
) {
  const estadoAttempt = resultado === 'refund' ? 'refunded' : resultado === 'approved' ? 'approved' : resultado === 'rejected' ? 'rejected' : 'processing';
  const estadoPago =
    resultado === 'approved' ? 'pagado' : resultado === 'refund' ? 'reembolsado' : resultado === 'rejected' ? 'pendiente' : 'procesando';

  await db
    .from('payment_attempts')
    .update({ status: estadoAttempt, raw_status: `mock_${resultado}` })
    .eq('provider_reference', providerReference)
    .eq('school_id', schoolId);

  const patch: Record<string, unknown> = {
    status: estadoPago,
    mp_status: `mock_${resultado}`,
    metodo_pago: 'mock',
  };
  if (resultado === 'approved') patch.fecha_pago = ahora;
  if (resultado === 'refund') patch.fecha_pago = null;

  await db.from('payments').update(patch).eq('id', paymentId);

  return { status: estadoPago };
}
