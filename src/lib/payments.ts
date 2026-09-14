import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPaymentProvider } from '@/lib/payments/factory';
import { pesosToCentavos } from '@/lib/money';
import { cicloLabel, APP_URL } from '@/lib/utils';
import type { Payment, School } from '@/lib/types';

/**
 * Monto limpio que le toca a un alumno para un concepto.
 * Prioridad: monto fijo del concepto > monto propio del alumno > monto del grupo.
 */
export function resolverMonto(args: {
  conceptoMontoFijo: number | null;
  alumnoMontoCustom: number | null;
  grupoMontoDefault: number | null;
}): number {
  if (args.conceptoMontoFijo != null && args.conceptoMontoFijo > 0) {
    return Number(args.conceptoMontoFijo);
  }
  if (args.alumnoMontoCustom != null && args.alumnoMontoCustom > 0) {
    return Number(args.alumnoMontoCustom);
  }
  return Number(args.grupoMontoDefault ?? 0);
}

/**
 * Asegura que un cargo (`payments` = "charge") tenga un intento de cobro
 * vigente con el PaymentProvider que le toque a esa escuela (mock si no ha
 * conectado nada real, Mercado Pago si ya conectó su cuenta). Se llama
 * tanto al generar el ciclo como al abrir /p/[token] (perezoso), para que
 * un fallo del proveedor al generar 400 links no deje pagos sin forma de
 * cobrarse.
 *
 * Idempotente: si ya existe un intento pendiente/procesando para este pago
 * con el MISMO proveedor, lo reutiliza en vez de crear uno nuevo.
 */
export async function asegurarIntentoDeCobro(
  db: SupabaseClient,
  payment: Pick<Payment, 'id' | 'link_token' | 'monto_total_cobrado' | 'fecha_vencimiento' | 'ciclo'>,
  school: Pick<School, 'id' | 'name'>,
  contexto: {
    conceptoNombre: string;
    alumnoNombre: string;
    studentId: string;
    conceptId: string;
    tutorNombre?: string | null;
    tutorEmail?: string | null;
  },
): Promise<{ providerId: string; providerReference: string | null; checkoutUrl: string | null; publicKey: string | null; error: string | null }> {
  const provider = await getPaymentProvider(school.id);

  const { data: existente } = await db
    .from('payment_attempts')
    .select('*')
    .eq('payment_id', payment.id)
    .eq('provider', provider.id)
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existente) {
    let publicKey: string | null = null;
    if (provider.id === 'mercadopago' && provider.getConnectionStatus) {
      const status = await provider.getConnectionStatus(school.id);
      publicKey = status.publicKey;
    }
    return {
      providerId: provider.id,
      providerReference: existente.provider_reference,
      checkoutUrl: null,
      publicKey,
      error: null,
    };
  }

  try {
    const intent = await provider.createCheckout({
      internalPaymentId: payment.id,
      schoolId: school.id,
      studentId: contexto.studentId,
      conceptId: contexto.conceptId,
      externalReference: payment.link_token,
      titulo: `${contexto.conceptoNombre} ${cicloLabel(payment.ciclo)} — ${contexto.alumnoNombre}`,
      totalCentavos: pesosToCentavos(Number(payment.monto_total_cobrado)),
      payerName: contexto.tutorNombre,
      payerEmail: contexto.tutorEmail,
      dueDate: payment.fecha_vencimiento,
      returnUrlBase: `${APP_URL}/p/${payment.link_token}`,
      notificationUrl: `${APP_URL}/api/webhooks/${provider.id}?school=${school.id}`,
    });

    // Compatibilidad: si es Mercado Pago, también se refleja en las
    // columnas legacy (mp_preference_id/mp_init_point) que usan CSV export
    // y reportes existentes.
    if (provider.id === 'mercadopago') {
      await db
        .from('payments')
        .update({ mp_preference_id: intent.providerReference, mp_init_point: intent.checkoutUrl })
        .eq('id', payment.id);
    }

    return {
      providerId: provider.id,
      providerReference: intent.providerReference,
      checkoutUrl: intent.checkoutUrl,
      publicKey: intent.publicKey,
      error: null,
    };
  } catch (e) {
    return {
      providerId: provider.id,
      providerReference: null,
      checkoutUrl: null,
      publicKey: null,
      error: e instanceof Error ? e.message : 'El proveedor de pagos no respondió',
    };
  }
}
