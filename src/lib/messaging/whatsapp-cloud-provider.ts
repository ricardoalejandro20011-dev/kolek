import 'server-only';
import { normalizarWhatsapp } from '@/lib/utils';
import { renderTemplate, META_TEMPLATE_NAME } from './templates';
import type { MessageTemplateVars, MessagingProvider, PreparedMessage, SendResult, TemplateKey, DeliveryStatus } from './types';

export interface WhatsAppCloudCreds {
  token: string;
  phoneNumberId: string;
}

/**
 * WhatsAppCloudProvider — llama a la Graph API de Meta de verdad. Solo se
 * instancia (ver factory.ts) cuando hay token + phone number id reales.
 *
 * Fuera de la ventana de 24h, Meta solo permite mandar TEMPLATES ya
 * aprobados — por eso siempre se manda `type: template`, nunca texto libre.
 */
export class WhatsAppCloudProvider implements MessagingProvider {
  readonly id = 'whatsapp_cloud' as const;

  constructor(private creds: WhatsAppCloudCreds, private apiVersion = 'v21.0') {}

  prepareMessage(telefono: string, templateKey: TemplateKey, vars: MessageTemplateVars): PreparedMessage {
    return { to: normalizarWhatsapp(telefono), templateKey, text: renderTemplate(templateKey, vars) };
  }

  async sendMessage(msg: PreparedMessage): Promise<SendResult> {
    if (!/^\d{10,15}$/.test(msg.to)) {
      return { ok: false, status: 'failed', providerMessageId: null, error: `Teléfono inválido: ${msg.to}` };
    }

    // El body de la plantilla se reconstruye a partir del texto ya armado
    // no es ideal (Meta pide variables por separado), así que aquí se arma
    // directo con las 5 variables posicionales que ya usa el template
    // aprobado — ver docs/integrations.md para el layout exacto esperado.
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: msg.to,
      type: 'template',
      template: {
        name: META_TEMPLATE_NAME[msg.templateKey],
        language: { code: 'es_MX' },
        components: [{ type: 'body', parameters: [{ type: 'text', text: msg.text }] }],
      },
    };

    try {
      const res = await fetch(
        `https://graph.facebook.com/${this.apiVersion}/${this.creds.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.creds.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          cache: 'no-store',
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msgErr = json?.error?.error_user_msg || json?.error?.message || `HTTP ${res.status}`;
        return { ok: false, status: 'failed', providerMessageId: null, error: String(msgErr).slice(0, 400) };
      }
      return { ok: true, status: 'sent', providerMessageId: json?.messages?.[0]?.id ?? null, error: null };
    } catch (e) {
      return {
        ok: false,
        status: 'failed',
        providerMessageId: null,
        error: e instanceof Error ? e.message.slice(0, 400) : 'Error de red',
      };
    }
  }

  async getDeliveryStatus(): Promise<DeliveryStatus | null> {
    // Meta no expone un GET de estado por mensaje — el estado llega por
    // webhook (ver processWebhook / /api/webhooks/whatsapp).
    return null;
  }
}
