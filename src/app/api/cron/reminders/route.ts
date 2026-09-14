import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { asegurarIntentoDeCobro } from '@/lib/payments';
import { enviarTemplate, getWaCreds, renderMensaje } from '@/lib/whatsapp';
import { cicloActual, cicloLabel, linkDePago, mapLimit } from '@/lib/utils';
import type { School } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET /api/cron/reminders
 *
 * Recordatorios automáticos (planes Crecimiento y Pro). Vercel Cron lo llama
 * a diario; ver vercel.json. Hace dos cosas:
 *   1. Marca como 'atrasado' todo pago pendiente vencido (todas las escuelas).
 *   2. Si hoy es uno de los días configurados en la escuela, reenvía el link
 *      por WhatsApp a los pagos pendientes o atrasados del ciclo en curso.
 *
 * Protegido con CRON_SECRET (Authorization: Bearer …).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get('authorization');

  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = createAdminClient();
  const hoy = new Date();
  const diaDelMes = hoy.getDate();
  const ciclo = cicloActual(hoy);

  // ── 1. Marcar atrasados ────────────────────────────────────────────
  const { data: marcados, error: errAtraso } = await db.rpc('marcar_atrasados');
  if (errAtraso) {
    console.error('[cron] No pude marcar atrasados:', errAtraso.message);
  }

  // ── 2. Escuelas que tocan hoy ──────────────────────────────────────
  const { data: escuelas } = await db
    .from('schools')
    .select('*')
    .in('plan', ['crecimiento', 'pro'])
    .returns<School[]>();

  const resumen: {
    escuela: string;
    enviados: number;
    en_cola: number;
    fallados: number;
  }[] = [];

  for (const school of escuelas ?? []) {
    const dias = school.recordatorios_dias ?? [];
    if (!dias.includes(diaDelMes)) continue;

    const { data: pagos } = await db
      .from('payments')
      .select(
        `id, school_id, student_id, concept_id, ciclo, link_token, monto_total_cobrado, fecha_vencimiento,
         students ( nombre_alumno, nombre_tutor, whatsapp_tutor, email_tutor, status ),
         concepts ( nombre )`,
      )
      .eq('school_id', school.id)
      .eq('ciclo', ciclo)
      .in('status', ['pendiente', 'atrasado'])
      .limit(1000);

    const pendientes = (pagos ?? []).filter(
      (p: any) => p.students?.status === 'activo' && p.students?.whatsapp_tutor,
    );

    if (!pendientes.length) continue;

    const creds = getWaCreds(school);
    let enviados = 0;
    let enCola = 0;
    let fallados = 0;

    await mapLimit(pendientes, 4, async (p: any) => {
      const alumno = p.students;
      const concepto = p.concepts?.nombre ?? 'Pago';

      await asegurarIntentoDeCobro(db, p, school, {
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

      if (!creds) {
        await db.from('whatsapp_logs').insert({
          school_id: school.id,
          payment_id: p.id,
          to: alumno.whatsapp_tutor,
          message: renderMensaje(vars),
          status: 'en_cola',
          error: `Recordatorio automático del día ${diaDelMes} — sin credenciales de WhatsApp`,
        });
        enCola++;
        return;
      }

      const envio = await enviarTemplate(creds, alumno.whatsapp_tutor, vars);
      await db.from('whatsapp_logs').insert({
        school_id: school.id,
        payment_id: p.id,
        to: alumno.whatsapp_tutor,
        message: renderMensaje(vars),
        wa_message_id: envio.waMessageId,
        status: envio.ok ? 'enviado' : 'fallado',
        error: envio.error,
        sent_at: envio.ok ? new Date().toISOString() : null,
      });

      if (envio.ok) enviados++;
      else fallados++;
    });

    resumen.push({ escuela: school.name, enviados, en_cola: enCola, fallados });
    console.info(
      `[cron] ${school.name}: ${enviados} enviados, ${enCola} en cola, ${fallados} fallados`,
    );
  }

  return NextResponse.json({
    ok: true,
    dia: diaDelMes,
    ciclo,
    pagos_marcados_atrasados: marcados ?? 0,
    escuelas_procesadas: resumen.length,
    resumen,
  });
}
