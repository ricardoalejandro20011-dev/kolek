import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { calcTotalConComision } from '@/lib/fees';
import { asegurarIntentoDeCobro, resolverMonto } from '@/lib/payments';
import { assertCan, AuthorizationError } from '@/lib/rbac';
import { evaluarAcceso, type Subscription } from '@/lib/subscriptions';
import { registrarAuditoria, ipDeRequest } from '@/lib/audit';
import { pesosToCentavos } from '@/lib/money';
import { mapLimit, vencimientoDeCiclo } from '@/lib/utils';
import type { Concept, Group, Profile, School, Student } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  school_id: z.string().uuid(),
  ciclo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'El ciclo debe ser YYYY-MM'),
  concept_id: z.string().uuid(),
  /** Vacío = todos los grupos, incluidos los alumnos sin grupo. */
  group_ids: z.array(z.string().uuid()).optional().default([]),
  /** Opcional: sobreescribe la fecha de vencimiento calculada. */
  fecha_vencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * POST /api/payments/generate-cycle
 *
 * Crea los cargos faltantes del ciclo para todos los alumnos ACTIVOS de los
 * grupos indicados, calcula el total con comisión y asegura el intento de
 * cobro con el proveedor que le toque a la escuela (mock o real). Es
 * idempotente por el UNIQUE(student_id, concept_id, ciclo) de `payments`:
 * generar el mismo ciclo dos veces nunca duplica cargos.
 */
export async function POST(req: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { data: perfil } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<Profile>();

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof z.ZodError ? e.errors[0]?.message : 'Cuerpo inválido' },
      { status: 400 },
    );
  }

  try {
    assertCan(perfil?.role, 'charges.generate');
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  // RLS ya limita a la escuela del usuario; esto confirma que el id coincide.
  const { data: school } = await supabase
    .from('schools')
    .select('*')
    .eq('id', body.school_id)
    .maybeSingle<School>();

  if (!school) {
    return NextResponse.json({ error: 'Escuela no encontrada' }, { status: 403 });
  }

  // Una escuela con la suscripción vencida (fuera de gracia) o cancelada no
  // puede generar cargos nuevos — sí puede seguir consultando/exportando.
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('school_id', school.id)
    .maybeSingle<Subscription>();
  const acceso = evaluarAcceso(sub);
  if (!acceso.accesoCompleto) {
    return NextResponse.json(
      { error: acceso.motivo ?? 'Tu suscripción no permite generar cargos nuevos.' },
      { status: 402 },
    );
  }

  const { data: concept } = await supabase
    .from('concepts')
    .select('*')
    .eq('id', body.concept_id)
    .eq('school_id', school.id)
    .maybeSingle<Concept>();

  if (!concept) {
    return NextResponse.json({ error: 'Concepto no encontrado' }, { status: 404 });
  }

  // ── Alumnos activos ────────────────────────────────────────────────
  let qStudents = supabase
    .from('students')
    .select('id, group_id, nombre_alumno, nombre_tutor, email_tutor, monto_custom')
    .eq('school_id', school.id)
    .eq('status', 'activo');

  if (body.group_ids.length > 0) {
    qStudents = qStudents.in('group_id', body.group_ids);
  }

  const { data: students, error: errStudents } = await qStudents;
  if (errStudents) {
    return NextResponse.json({ error: errStudents.message }, { status: 500 });
  }
  if (!students?.length) {
    return NextResponse.json(
      { error: 'No hay alumnos activos en esos grupos' },
      { status: 422 },
    );
  }

  const { data: groups } = await supabase
    .from('groups')
    .select('id, monto_default')
    .eq('school_id', school.id);

  const montoGrupo = new Map<string, number>(
    ((groups as Pick<Group, 'id' | 'monto_default'>[]) ?? []).map((g) => [
      g.id,
      Number(g.monto_default),
    ]),
  );

  // ── Qué pagos ya existen para este ciclo/concepto ──────────────────
  const { data: existentes } = await supabase
    .from('payments')
    .select('student_id')
    .eq('school_id', school.id)
    .eq('concept_id', concept.id)
    .eq('ciclo', body.ciclo);

  const yaTienen = new Set((existentes ?? []).map((p) => p.student_id as string));

  const fechaVenc =
    body.fecha_vencimiento ?? vencimientoDeCiclo(body.ciclo, school.dia_vencimiento);

  const sinMonto: string[] = [];
  const nuevos = (students as Pick<
    Student,
    'id' | 'group_id' | 'nombre_alumno' | 'nombre_tutor' | 'email_tutor' | 'monto_custom'
  >[])
    .filter((s) => !yaTienen.has(s.id))
    .map((s) => {
      const monto = resolverMonto({
        conceptoMontoFijo: concept.monto_fijo,
        alumnoMontoCustom: s.monto_custom,
        grupoMontoDefault: s.group_id ? (montoGrupo.get(s.group_id) ?? 0) : 0,
      });
      if (monto <= 0) sinMonto.push(s.nombre_alumno);
      return { student: s, monto };
    })
    .filter((x) => x.monto > 0);

  if (nuevos.length === 0) {
    return NextResponse.json({
      creados: 0,
      omitidos_ya_existian: yaTienen.size,
      sin_monto: sinMonto,
      intentos_de_cobro_creados: 0,
      mensaje:
        sinMonto.length > 0
          ? 'Ningún alumno tiene monto asignado. Define el monto del grupo o del alumno.'
          : 'Todos los alumnos ya tenían su pago de este ciclo.',
    });
  }

  // ── Registro del ciclo (billing_cycles) ────────────────────────────
  const { data: cycle } = await supabase
    .from('billing_cycles')
    .insert({
      school_id: school.id,
      concept_id: concept.id,
      ciclo: body.ciclo,
      group_ids: body.group_ids,
      status: 'published',
      charges_count: nuevos.length,
      created_by: user.id,
      published_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  // ── Insertar cargos ─────────────────────────────────────────────────
  const filas = nuevos.map(({ student, monto }) => {
    const totalConComision = calcTotalConComision(monto);
    return {
      school_id: school.id,
      student_id: student.id,
      concept_id: concept.id,
      ciclo: body.ciclo,
      monto_concepto: monto,
      monto_total_cobrado: totalConComision,
      amount_centavos: pesosToCentavos(monto),
      total_centavos: pesosToCentavos(totalConComision),
      fecha_vencimiento: fechaVenc,
      status: 'pendiente' as const,
      billing_cycle_id: cycle?.id ?? null,
    };
  });

  const creados: {
    id: string;
    link_token: string;
    monto_total_cobrado: number;
    fecha_vencimiento: string;
    ciclo: string;
    student_id: string;
  }[] = [];

  for (let i = 0; i < filas.length; i += 200) {
    const { data, error } = await supabase
      .from('payments')
      .insert(filas.slice(i, i + 200))
      .select('id, link_token, monto_total_cobrado, fecha_vencimiento, ciclo, student_id');
    if (error) {
      return NextResponse.json(
        { error: `No se pudieron crear los cargos: ${error.message}`, creados: creados.length },
        { status: 500 },
      );
    }
    creados.push(...(data as typeof creados));
  }

  // ── Intentos de cobro con el proveedor que le toque a la escuela ───
  const porAlumno = new Map(nuevos.map(({ student }) => [student.id, student]));
  let intentosCreados = 0;
  let errorProveedor: string | null = null;

  const resultados = await mapLimit(creados, 6, async (p) => {
    const s = porAlumno.get(p.student_id);
    return asegurarIntentoDeCobro(supabase, p, school, {
      conceptoNombre: concept.nombre,
      alumnoNombre: s?.nombre_alumno ?? 'Alumno',
      studentId: p.student_id,
      conceptId: concept.id,
      tutorNombre: s?.nombre_tutor,
      tutorEmail: s?.email_tutor,
    });
  });

  for (const r of resultados) {
    if (r.providerReference) intentosCreados++;
    else if (!errorProveedor && r.error) errorProveedor = r.error;
  }

  await registrarAuditoria({
    schoolId: school.id,
    userId: user.id,
    action: 'billing_cycle.generated',
    entityType: 'billing_cycle',
    entityId: cycle?.id,
    after: { ciclo: body.ciclo, concept_id: concept.id, cargos_creados: creados.length },
    ip: ipDeRequest(req),
  });

  return NextResponse.json({
    creados: creados.length,
    omitidos_ya_existian: yaTienen.size,
    sin_monto: sinMonto,
    intentos_de_cobro_creados: intentosCreados,
    // Los links funcionan aunque el proveedor falle: /p/[token] reintenta al abrirse.
    aviso_proveedor: intentosCreados < creados.length ? errorProveedor : null,
  });
}
