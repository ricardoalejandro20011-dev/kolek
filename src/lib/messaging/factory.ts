import 'server-only';
import { ManualWhatsAppProvider } from './manual-provider';
import { MockMessagingProvider } from './mock-provider';
import { WhatsAppCloudProvider } from './whatsapp-cloud-provider';
import type { MessagingProvider } from './types';

const manual = new ManualWhatsAppProvider();
const mock = new MockMessagingProvider();

export interface SchoolWaCreds {
  whatsapp_token?: string | null;
  whatsapp_phone_number_id?: string | null;
}

/**
 * Decide el MessagingProvider por escuela: credenciales propias > fallback
 * de plataforma > manual. `MESSAGING_PROVIDER_MODE=mock` (solo pensado para
 * pruebas/demo) fuerza el mock sin importar credenciales.
 */
export function getMessagingProvider(school: SchoolWaCreds): MessagingProvider {
  if ((process.env.MESSAGING_PROVIDER_MODE ?? 'manual') === 'mock') return mock;

  const token = school.whatsapp_token?.trim() || process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId =
    school.whatsapp_phone_number_id?.trim() || process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

  if (token && phoneNumberId) {
    return new WhatsAppCloudProvider({ token, phoneNumberId }, process.env.WHATSAPP_API_VERSION);
  }
  return manual;
}

export { manual as manualWhatsAppProvider, mock as mockMessagingProvider };
export { linkWaMe } from './manual-provider';
