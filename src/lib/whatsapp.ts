/**
 * Kolek — capa de compatibilidad sobre src/lib/messaging/* (MessagingProvider).
 * Mantiene las firmas que ya usan /api/cron/reminders y /api/whatsapp/send-bulk
 * para no tocar esas rutas de golpe, pero por dentro ya pasa por la
 * abstracción nueva (manual / whatsapp_cloud / mock según credenciales).
 */
import { getMessagingProvider, type SchoolWaCreds } from '@/lib/messaging/factory';
import { renderTemplate } from '@/lib/messaging/templates';
import type { MessageTemplateVars } from '@/lib/messaging/types';

export type VarsPlantilla = MessageTemplateVars;

export interface WaCreds {
  token: string;
  phoneNumberId: string;
  fallback: boolean;
}

/** Credenciales de WhatsApp de la escuela, con fallback al .env — solo para pintar UI de estado. */
export function getWaCreds(school: SchoolWaCreds): WaCreds | null {
  const propio = school.whatsapp_token?.trim() && school.whatsapp_phone_number_id?.trim();
  if (propio) {
    return {
      token: school.whatsapp_token!.trim(),
      phoneNumberId: school.whatsapp_phone_number_id!.trim(),
      fallback: false,
    };
  }
  const et = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const ep = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (et && ep) return { token: et, phoneNumberId: ep, fallback: true };
  return null;
}

export function renderMensaje(v: VarsPlantilla): string {
  return renderTemplate('personalizado', v);
}

export interface ResultadoEnvio {
  ok: boolean;
  waMessageId: string | null;
  error: string | null;
}

export async function enviarTemplate(
  creds: WaCreds,
  telefono: string,
  vars: VarsPlantilla,
): Promise<ResultadoEnvio> {
  const provider = getMessagingProvider({
    whatsapp_token: creds.token,
    whatsapp_phone_number_id: creds.phoneNumberId,
  });
  const msg = provider.prepareMessage(telefono, 'personalizado', vars);
  const res = await provider.sendMessage(msg);
  return { ok: res.status === 'sent', waMessageId: res.providerMessageId, error: res.error };
}

export { linkWaMe } from '@/lib/messaging/factory';
