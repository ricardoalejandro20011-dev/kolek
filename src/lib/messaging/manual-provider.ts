import 'server-only';
import { normalizarWhatsapp } from '@/lib/utils';
import { renderTemplate } from './templates';
import type { MessageTemplateVars, MessagingProvider, PreparedMessage, SendResult, TemplateKey } from './types';

/**
 * ManualWhatsAppProvider — el modo por default cuando la escuela no ha
 * conectado WhatsApp Cloud API. NUNCA manda nada por su cuenta: arma el
 * mensaje, lo deja listo para copiar o abrir en wa.me, y reporta 'queued'.
 * Marcarlo como 'sent' sin haberlo mandado de verdad sería mentirle a la
 * escuela sobre si el papá recibió algo — por eso el estado siempre es
 * honesto.
 */
export class ManualWhatsAppProvider implements MessagingProvider {
  readonly id = 'manual' as const;

  prepareMessage(telefono: string, templateKey: TemplateKey, vars: MessageTemplateVars): PreparedMessage {
    return { to: normalizarWhatsapp(telefono), templateKey, text: renderTemplate(templateKey, vars) };
  }

  async sendMessage(msg: PreparedMessage): Promise<SendResult> {
    return { ok: true, status: 'queued', providerMessageId: null, error: null };
  }
}

/** Link wa.me listo para enviar a mano. */
export function linkWaMe(telefono: string, mensaje: string): string {
  return `https://wa.me/${normalizarWhatsapp(telefono)}?text=${encodeURIComponent(mensaje)}`;
}
