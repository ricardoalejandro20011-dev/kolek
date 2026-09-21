import 'server-only';
import { Resend } from 'resend';
import { brand } from '@/config/brand';

/**
 * Envío de correo vía Resend — el paquete ya era dependencia del proyecto.
 * Sin RESEND_API_KEY configurada, esta función no hace nada (no truena, no
 * bloquea el flujo que la llama): el canal principal de Kolek sigue siendo
 * WhatsApp. Ver docs/integrations.md.
 */
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

export interface NuevaSolicitudDemo {
  nombre: string;
  escuela: string;
  whatsapp: string;
  alumnosAprox: string;
}

/**
 * Avisa que llegó un lead nuevo desde /demo.
 *
 * Remitente: por default usa el dominio compartido de Resend
 * (onboarding@resend.dev), que manda sin necesitar verificar ningún DNS —
 * suficiente para un aviso INTERNO. `RESEND_FROM` lo sobreescribe una vez
 * que `ravela.online` esté verificado en Resend, si se quiere mandar con
 * la marca puesta.
 *
 * Destinatario: LEAD_NOTIFICATION_EMAIL (el correo que de verdad revisas
 * a diario) — no necesariamente brand.contactEmail, que es el correo
 * PÚBLICO que ven las escuelas y puede no tener buzón propio todavía.
 * `reply_to` sí queda como brand.contactEmail para que, si contestas
 * este aviso, la respuesta salga con la cara de Kolek.
 */
export async function notificarNuevaSolicitudDemo(datos: NuevaSolicitudDemo): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const from = process.env.RESEND_FROM?.trim() || `${brand.name} <onboarding@resend.dev>`;
  const to = process.env.LEAD_NOTIFICATION_EMAIL?.trim() || brand.contactEmail;

  try {
    await resend.emails.send({
      from,
      to,
      replyTo: brand.contactEmail,
      subject: `Nueva solicitud de demo — ${datos.escuela}`,
      text: [
        `Escuela: ${datos.escuela}`,
        `Nombre: ${datos.nombre}`,
        `WhatsApp: ${datos.whatsapp}`,
        `Alumnos aproximados: ${datos.alumnosAprox}`,
      ].join('\n'),
    });
  } catch (e) {
    // Un fallo de correo nunca debe tumbar la captura del lead — ya quedó
    // guardado en demo_requests, que es la fuente de verdad.
    console.error('[email] No se pudo notificar la solicitud de demo:', e);
  }
}
