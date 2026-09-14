import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  CreatePaymentInput,
  PaymentIntent,
  PaymentProvider,
  PaymentStatus,
  Refund,
  WebhookEvent,
} from './types';

/**
 * MockPaymentProvider — permite probar el flujo completo (cobro → checkout
 * → conciliación → dashboard) sin credenciales reales de ningún proveedor.
 *
 * No hace NINGÚN cargo real ni llama a ningún servicio externo. El estado
 * vive en `payment_attempts` y se cambia únicamente desde
 * /api/payments/simulate, un endpoint que solo existe para probar y que
 * está bloqueado si PAYMENT_PROVIDER_MODE !== 'mock'.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly id = 'mock' as const;
  readonly requiresConnection = false;

  async createCheckout(input: CreatePaymentInput): Promise<PaymentIntent> {
    const db = createAdminClient();
    const providerReference = `mock_${input.internalPaymentId}`;

    await db.from('payment_attempts').insert({
      school_id: input.schoolId,
      payment_id: input.internalPaymentId,
      provider: 'mock',
      provider_reference: providerReference,
      status: 'pending',
      amount_centavos: input.totalCentavos,
      raw_status: 'pending',
    });

    return { providerReference, checkoutUrl: null, publicKey: null };
  }

  async getPayment(providerReference: string, schoolId: string): Promise<PaymentStatus | null> {
    const db = createAdminClient();
    const { data } = await db
      .from('payment_attempts')
      .select('*')
      .eq('provider_reference', providerReference)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return null;

    return {
      providerReference,
      status: mapMockStatus(data.status),
      rawStatus: data.status,
      amountCentavos: data.amount_centavos ?? null,
      approvedAt: data.status === 'approved' ? data.updated_at : null,
    };
  }

  async validateWebhook(): Promise<boolean> {
    // El mock no recibe webhooks externos — se "concilia" desde /api/payments/simulate.
    return true;
  }

  async processWebhook(rawBody: string): Promise<WebhookEvent> {
    const body = JSON.parse(rawBody || '{}');
    return {
      eventId: body.eventId ?? `mock_${Date.now()}`,
      type: 'payment_update',
      internalPaymentId: body.internalPaymentId ?? null,
      providerReference: body.providerReference ?? null,
    };
  }

  async refundPayment(providerReference: string, schoolId: string): Promise<Refund> {
    const db = createAdminClient();
    const { data } = await db
      .from('payment_attempts')
      .update({ status: 'refunded', raw_status: 'refunded' })
      .eq('provider_reference', providerReference)
      .eq('school_id', schoolId)
      .select('amount_centavos')
      .maybeSingle();

    return { ok: !!data, refundedCentavos: data?.amount_centavos ?? 0 };
  }
}

function mapMockStatus(status: string): PaymentStatus['status'] {
  switch (status) {
    case 'approved':
      return 'approved';
    case 'rejected':
      return 'rejected';
    case 'refunded':
      return 'refunded';
    case 'canceled':
      return 'canceled';
    case 'processing':
      return 'processing';
    default:
      return 'pending';
  }
}
