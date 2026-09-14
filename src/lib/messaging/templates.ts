import type { MessageTemplateVars, TemplateKey } from './types';

/**
 * Texto de cada plantilla. Para WhatsApp Cloud API real, el `name` debe
 * coincidir EXACTO con una plantilla aprobada en Meta Business Manager
 * (no se puede mandar texto libre fuera de la ventana de 24h). Mientras no
 * haya token, este mismo texto es lo que se guarda listo para copiar/pegar
 * o abrir en wa.me — nada se pierde por no tener WhatsApp Cloud conectado.
 */
export function renderTemplate(key: TemplateKey, v: MessageTemplateVars): string {
  switch (key) {
    case 'proximo_vencimiento':
      return `Hola ${v.tutor}, te recordamos que ${v.concepto} de ${v.ciclo} por $${v.monto} está por vencer. Paga aquí: ${v.link}`;
    case 'vence_hoy':
      return `Hola ${v.tutor}, hoy vence ${v.concepto} de ${v.ciclo} por $${v.monto}. Paga aquí: ${v.link}`;
    case 'pago_atrasado':
      return `Hola ${v.tutor}, ${v.concepto} de ${v.ciclo} por $${v.monto} está atrasado. Puedes ponerte al corriente aquí: ${v.link}`;
    case 'confirmacion_pago':
      return `Hola ${v.tutor}, confirmamos tu pago de ${v.concepto} de ${v.ciclo} por $${v.monto}. ¡Gracias!`;
    case 'segundo_recordatorio':
      return `Hola ${v.tutor}, seguimos sin ver tu pago de ${v.concepto} de ${v.ciclo} ($${v.monto}). Si ya pagaste por otro medio, avísanos. Link: ${v.link}`;
    case 'personalizado':
    default:
      return `Hola ${v.tutor}, te compartimos el link de ${v.concepto} de ${v.ciclo} por $${v.monto}. Paga aquí: ${v.link}`;
  }
}

/** Nombre de plantilla aprobada en Meta para cada TemplateKey (WhatsApp Cloud real). */
export const META_TEMPLATE_NAME: Record<TemplateKey, string> = {
  proximo_vencimiento: 'kolek_proximo_vencimiento',
  vence_hoy: 'kolek_vence_hoy',
  pago_atrasado: 'kolek_pago_atrasado',
  confirmacion_pago: 'kolek_confirmacion_pago',
  segundo_recordatorio: 'kolek_segundo_recordatorio',
  personalizado: 'kolek_link_pago',
};
