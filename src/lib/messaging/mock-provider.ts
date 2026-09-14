import 'server-only';
import crypto from 'node:crypto';
import { normalizarWhatsapp } from '@/lib/utils';
import { renderTemplate } from './templates';
import type { MessageTemplateVars, MessagingProvider, PreparedMessage, SendResult, TemplateKey } from './types';

/**
 * MockMessagingProvider — SOLO para probar el flujo de extremo a extremo en
 * modo demo/sandbox (por ejemplo, un botón "Simular envío" en desarrollo).
 * A diferencia de ManualWhatsAppProvider, sí marca 'sent' — pero nunca toca
 * una API real. No se activa por default en producción
 * (MESSAGING_PROVIDER_MODE debe ser explícitamente 'mock').
 */
export class MockMessagingProvider implements MessagingProvider {
  readonly id = 'mock' as const;

  prepareMessage(telefono: string, templateKey: TemplateKey, vars: MessageTemplateVars): PreparedMessage {
    return { to: normalizarWhatsapp(telefono), templateKey, text: renderTemplate(templateKey, vars) };
  }

  async sendMessage(): Promise<SendResult> {
    return { ok: true, status: 'sent', providerMessageId: `mock_${crypto.randomUUID()}`, error: null };
  }
}
