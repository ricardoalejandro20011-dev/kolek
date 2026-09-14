import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { checarRateLimit } from '@/lib/rate-limit';
import { ipDeRequest } from '@/lib/audit';
import { track } from '@/lib/analytics';
import { notificarNuevaSolicitudDemo } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  nombre: z.string().trim().min(1, 'Falta tu nombre').max(120),
  escuela: z.string().trim().min(1, 'Falta el nombre de la escuela').max(160),
  whatsapp: z.string().trim().min(10, 'WhatsApp inválido').max(20),
  alumnos_aprox: z.string().trim().min(1, 'Falta el número aproximado de alumnos').max(40),
  acepta_contacto: z.literal(true, {
    errorMap: () => ({ message: 'Necesitamos tu autorización para contactarte' }),
  }),
  // Honeypot: los bots suelen rellenar todos los campos del formulario.
  // Un humano nunca ve ni toca este input (está oculto por CSS).
  sitio_web: z.string().max(0).optional().default(''),
});

/**
 * POST /api/demo-request
 *
 * Endpoint público (sin auth: el tutor/director todavía no tiene cuenta).
 * No abrimos RLS a `anon` para esto — insertamos con service_role y
 * validamos con zod en el servidor. Capas anti-spam: rate limit por IP
 * (mejor esfuerzo, ver src/lib/rate-limit.ts) + honeypot.
 */
export async function POST(req: Request) {
  const ip = ipDeRequest(req) ?? 'desconocida';
  const rl = checarRateLimit(`demo-request:${ip}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' },
      { status: 429 },
    );
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof z.ZodError ? e.errors[0]?.message : 'Cuerpo inválido' },
      { status: 400 },
    );
  }

  if (body.sitio_web) {
    // Honeypot disparado: respondemos 200 "falso" para no darle pistas al bot.
    return NextResponse.json({ ok: true });
  }

  const db = createAdminClient();
  const { error } = await db.from('demo_requests').insert({
    nombre: body.nombre,
    escuela: body.escuela,
    whatsapp: body.whatsapp,
    alumnos_aprox: body.alumnos_aprox,
    source: 'landing',
  });

  if (error) {
    console.error('[demo-request] No se pudo guardar:', error.message);
    return NextResponse.json({ error: 'No se pudo enviar. Intenta de nuevo.' }, { status: 500 });
  }

  await track('demo_form_submit', { alumnos_aprox: body.alumnos_aprox });
  await notificarNuevaSolicitudDemo({
    nombre: body.nombre,
    escuela: body.escuela,
    whatsapp: body.whatsapp,
    alumnosAprox: body.alumnos_aprox,
  });

  return NextResponse.json({ ok: true });
}
