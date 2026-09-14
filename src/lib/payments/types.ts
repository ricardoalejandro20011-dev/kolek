import 'server-only';

/**
 * ── PaymentProvider ──────────────────────────────────────────────────────
 * Contrato único que debe cumplir cualquier proveedor de cobro. La lógica
 * de negocio (generar ciclo, checkout público, webhook) SOLO habla con esta
 * interfaz — nunca importa `mercadopago` ni ningún SDK de proveedor
 * directamente. Así se puede agregar Openpay/STP el día de mañana sin tocar
 * una sola línea de las rutas o componentes que ya funcionan.
 */

export interface PaymentIntent {
  /** Identificador del intento en el proveedor (preference id, checkout id...). */
  providerReference: string;
  /** URL a la que se manda al tutor (o null si el provider usa un widget embebido). */
  checkoutUrl: string | null;
  /** Llave pública, si el provider necesita renderizar un widget en el navegador. */
  publicKey: string | null;
  raw?: unknown;
}

export type PaymentStatusNormalizado =
  | 'pending'
  | 'processing'
  | 'approved'
  | 'rejected'
  | 'refunded'
  | 'canceled';

export interface PaymentStatus {
  providerReference: string;
  status: PaymentStatusNormalizado;
  rawStatus: string;
  amountCentavos: number | null;
  approvedAt: string | null;
}

export interface Refund {
  ok: boolean;
  refundedCentavos: number;
  raw?: unknown;
}

export interface WebhookEvent {
  /** ID único del evento en el proveedor — clave de idempotencia. */
  eventId: string;
  type: 'payment_update' | 'unknown';
  /** payment_id interno (nuestro `payments.id`) si el proveedor lo trae. */
  internalPaymentId: string | null;
  providerReference: string | null;
}

export interface CreatePaymentInput {
  /** payments.id (nuestro "charge") — SIEMPRE viaja como external_reference. */
  internalPaymentId: string;
  schoolId: string;
  studentId: string;
  conceptId: string;
  /** Referencia externa opuesta a IDs secuenciales — uuid del link público. */
  externalReference: string;
  titulo: string;
  totalCentavos: number;
  payerName?: string | null;
  payerEmail?: string | null;
  dueDate?: string | null;
  /** URL a la que Kolek debe volver después del checkout hospedado. */
  returnUrlBase: string;
  /** URL que el proveedor debe golpear para notificar (nuestro webhook). */
  notificationUrl: string;
}

export interface ConnectionStatus {
  connected: boolean;
  externalAccountId: string | null;
  publicKey: string | null;
  lastError: string | null;
}

export interface PaymentProvider {
  readonly id: 'mercadopago' | 'mock' | 'openpay' | 'stp';

  /** true si este provider requiere que la escuela conecte una cuenta (OAuth). */
  readonly requiresConnection: boolean;

  /** Paso 1 de OAuth: a dónde mandar al owner de la escuela para autorizar. */
  createConnectionUrl?(schoolId: string, redirectUri: string): string;

  /** Paso 2 de OAuth: intercambia el `code` del callback por tokens. */
  exchangeAuthorizationCode?(
    schoolId: string,
    code: string,
    redirectUri: string,
  ): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: string | null; externalAccountId: string | null; publicKey: string | null }>;

  refreshConnection?(schoolId: string): Promise<{ accessToken: string; expiresAt: string | null }>;

  disconnect?(schoolId: string): Promise<void>;

  getConnectionStatus?(schoolId: string): Promise<ConnectionStatus>;

  createCheckout(input: CreatePaymentInput): Promise<PaymentIntent>;

  getPayment(providerReference: string, schoolId: string): Promise<PaymentStatus | null>;

  /** Valida la firma del request crudo. Debe correr ANTES de leer el body como confiable. */
  validateWebhook(req: Request, rawBody: string): Promise<boolean>;

  /** Extrae el evento normalizado de un webhook YA validado. */
  processWebhook(rawBody: string, req: Request): Promise<WebhookEvent>;

  refundPayment(providerReference: string, schoolId: string, amountCentavos?: number): Promise<Refund>;
}
