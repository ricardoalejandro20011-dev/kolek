import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { mercadoPagoPlataformaConfigurada } from '@/config/env';
import { MockPaymentProvider } from './mock-provider';
import { MercadoPagoProvider } from './mercadopago-provider';
import type { PaymentProvider } from './types';

const mock = new MockPaymentProvider();
const mercadoPago = new MercadoPagoProvider();

/**
 * Decide el PaymentProvider para UNA escuela. Nunca a nivel global: dos
 * escuelas en la misma instancia de Kolek pueden estar en modos distintos
 * (una ya conectó Mercado Pago, otra sigue en modo prueba).
 *
 * Reglas, en orden:
 *   1. Si la plataforma no tiene MERCADOPAGO_CLIENT_ID/SECRET → mock, siempre.
 *      (Nunca se intenta un OAuth con credenciales que no existen.)
 *   2. Si la escuela no tiene una conexión `connected` en
 *      payment_provider_connections → mock (puede probar todo el flujo
 *      mientras conecta su cuenta real).
 *   3. Si tiene conexión activa → MercadoPagoProvider real.
 */
export async function getPaymentProvider(schoolId: string): Promise<PaymentProvider> {
  if (!mercadoPagoPlataformaConfigurada()) return mock;

  const db = createAdminClient();
  const { data } = await db
    .from('payment_provider_connections')
    .select('status')
    .eq('school_id', schoolId)
    .eq('provider', 'mercadopago')
    .maybeSingle();

  return data?.status === 'connected' ? mercadoPago : mock;
}

/** Para pantallas que necesitan saber "¿en qué modo estoy?" sin resolver el provider completo. */
export async function getPaymentMode(schoolId: string): Promise<'mock' | 'mercadopago'> {
  const provider = await getPaymentProvider(schoolId);
  return provider.id === 'mercadopago' ? 'mercadopago' : 'mock';
}

export { mock as mockPaymentProvider, mercadoPago as mercadoPagoProvider };
