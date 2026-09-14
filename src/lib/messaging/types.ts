import 'server-only';

/**
 * ── MessagingProvider ────────────────────────────────────────────────────
 * Contrato único para enviar recordatorios. La lógica de negocio (cron,
 * envío masivo, checkout) nunca llama a la API de Meta directo — siempre
 * pasa por esta interfaz, así WhatsApp deja de ser una dependencia dura.
 */

export interface MessageTemplateVars {
  tutor: string;
  concepto: string;
  ciclo: string;
  /** Total ya formateado sin símbolo — "1,895.60" */
  monto: string;
  link: string;
}

export type TemplateKey =
  | 'proximo_vencimiento'
  | 'vence_hoy'
  | 'pago_atrasado'
  | 'confirmacion_pago'
  | 'segundo_recordatorio'
  | 'personalizado';

export interface PreparedMessage {
  to: string;
  templateKey: TemplateKey;
  text: string;
}

export interface SendResult {
  ok: boolean;
  /** 'queued' cuando no hay credenciales: el mensaje quedó listo pero NO se mandó. */
  status: 'sent' | 'queued' | 'failed';
  providerMessageId: string | null;
  error: string | null;
}

export interface DeliveryStatus {
  providerMessageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  error: string | null;
}

export interface MessagingProvider {
  readonly id: 'whatsapp_cloud' | 'manual' | 'mock';

  /** Arma el texto final a partir de la plantilla — no manda nada todavía. */
  prepareMessage(telefono: string, templateKey: TemplateKey, vars: MessageTemplateVars): PreparedMessage;

  /** Intenta mandarlo de verdad. Sin credenciales, debe regresar status 'queued', NUNCA 'sent' falso. */
  sendMessage(msg: PreparedMessage): Promise<SendResult>;

  getDeliveryStatus?(providerMessageId: string): Promise<DeliveryStatus | null>;

  processWebhook?(rawBody: string, req: Request): Promise<DeliveryStatus[]>;
}

export const TEMPLATE_LABEL: Record<TemplateKey, string> = {
  proximo_vencimiento: 'Próximo a vencer',
  vence_hoy: 'Vence hoy',
  pago_atrasado: 'Pago atrasado',
  confirmacion_pago: 'Confirmación de pago',
  segundo_recordatorio: 'Segundo recordatorio',
  personalizado: 'Personalizado',
};
