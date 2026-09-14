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

/** Avisa al correo de contacto de Kolek que llegó un lead nuevo desde /demo. */
export async function notificarNuevaSolicitudDemo(datos: NuevaSolicitudDemo): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const from = process.env.RESEND_FROM?.trim() || `${brand.name} <notificaciones@kolek.mx>`;

  try {
    await resend.emails.send({
      from,
      to: brand.contactEmail,
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
