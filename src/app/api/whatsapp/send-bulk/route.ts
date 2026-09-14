import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { asegurarIntentoDeCobro } from '@/lib/payments';
import { enviarTemplate, getWaCreds, renderMensaje } from '@/lib/whatsapp';
import { cicloLabel, linkDePago, mapLimit } from '@/lib/utils';
import type { School } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const Body = z.object({
  payment_ids: z.array(z.string().uuid()).min(1).max(500),
});

interface FilaPago {
  id: string;
  school_id: string;
  student_id: string;
  concept_id: string;
  ciclo: string;
  link_token: string;
  monto_total_cobrado: number;
  fecha_vencimiento: string;
  students: {
    nombre_alumno: string;
    nombre_tutor: string;
    whatsapp_tutor: string;
    email_tutor: string | null;
  } | null;
  concepts: { nombre: string } | null;
}

/**
 * POST /api/whatsapp/send-bulk
 *
 * Crea un registro en whatsapp_logs por cada pago y, si hay credenciales de
 * WhatsApp Cloud API, manda el template aprobado. Sin token, el log queda en
 * 'en_cola' con el mensaje completo listo para enviarse a mano desde
 * /dashboard/whatsapp. Nada se pierde en silencio.
 */
export async function POST(req: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof z.ZodError ? e.errors[0]?.message : 'Cuerpo inválido' },
      { status: 400 },
    );
  }

  const { data: pagos, error } = await supabase
    .from('payments')
    .select(
      `id, school_id, student_id, concept_id, ciclo, link_token, monto_total_cobrado, fecha_vencimiento,
       students ( nombre_alumno, nombre_tutor, whatsapp_tutor, email_tutor ),
       concepts ( nombre )`,
    )
    .in('id', body.payment_ids)
    .returns<FilaPago[]>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!pagos?.length) {
    return NextResponse.json({ error: 'No encontré esos pagos' }, { status: 404 });
  }

  const { data: school } = await supabase
    .from('schools')
    .select('*')
    .eq('id', pagos[0].school_id)
    .maybeSingle<School>();

  if (!school) return NextResponse.json({ error: 'Escuela no encontrada' }, { status: 403 });

  const creds = getWaCreds(school);

  const resultados = await mapLimit(pagos, 5, async (p) => {
    const alumno = p.students;
    const concepto = p.concepts?.nombre ?? 'Pago';

    if (!alumno?.whatsapp_tutor) {
      return { id: p.id, estado: 'fallado' as const, error: 'El tutor no tiene WhatsApp' };
    }

    // El link debe llevar un intento de cobro listo; si el proveedor falló
    // antes, se reintenta aquí.
    await asegurarIntentoDeCobro(supabase, p, school, {
      conceptoNombre: concepto,
      alumnoNombre: alumno.nombre_alumno,
      studentId: p.student_id,
      conceptId: p.concept_id,
      tutorNombre: alumno.nombre_tutor,
      tutorEmail: alumno.email_tutor,
    });

    const vars = {
      tutor: alumno.nombre_tutor,
      concepto,
      ciclo: cicloLabel(p.ciclo),
      monto: Number(p.monto_total_cobrado).toLocaleString('es-MX', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      link: linkDePago(p.link_token),
    };
    const mensaje = renderMensaje(vars);

    if (!creds) {
      await supabase.from('whatsapp_logs').insert({
        school_id: school.id,
        payment_id: p.id,
        to: alumno.whatsapp_tutor,
        message: mensaje,
        status: 'en_cola',
        error: 'Sin credenciales de WhatsApp Cloud API — listo para envío manual',
      });
      return { id: p.id, estado: 'en_cola' as const, error: null };
    }

    const envio = await enviarTemplate(creds, alumno.whatsapp_tutor, vars);

    await supabase.from('whatsapp_logs').insert({
      school_id: school.id,
      payment_id: p.id,
      to: alumno.whatsapp_tutor,
      message: mensaje,
      wa_message_id: envio.waMessageId,
      status: envio.ok ? 'enviado' : 'fallado',
      error: envio.error,
      sent_at: envio.ok ? new Date().toISOString() : null,
    });

    return {
      id: p.id,
      estado: envio.ok ? ('enviado' as const) : ('fallado' as const),
      error: envio.error,
    };
  });

  const enviados = resultados.filter((r) => r.estado === 'enviado').length;
  const enCola = resultados.filter((r) => r.estado === 'en_cola').length;
  const fallados = resultados.filter((r) => r.estado === 'fallado');

  return NextResponse.json({
    enviados,
    en_cola: enCola,
    fallados: fallados.length,
    primer_error: fallados[0]?.error ?? null,
    modo: creds ? (creds.fallback ? 'plataforma' : 'escuela') : 'manual',
  });
}
