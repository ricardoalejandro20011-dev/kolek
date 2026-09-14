import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertCan, AuthorizationError } from '@/lib/rbac';
import { formatFecha } from '@/lib/utils';
import type { PaymentRow, Profile } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLUMNAS = [
  'alumno',
  'grupo',
  'concepto',
  'ciclo',
  'tutor',
  'whatsapp_tutor',
  'monto_concepto',
  'total_cobrado_al_tutor',
  'comision',
  'estado',
  'metodo_pago',
  'fecha_vencimiento',
  'fecha_pago',
  'mp_payment_id',
];

function escapar(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * GET /api/export?ciclo=2026-08&status=pagado
 * Exportación contable en CSV. Reporta el monto limpio del concepto (lo que
 * recibe la escuela) y aparte lo que pagó el tutor, para que la conciliación
 * contra el estado de cuenta de Mercado Pago cuadre al peso.
 */
export async function GET(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: perfil } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<Profile>();
  try {
    assertCan(perfil?.role, 'reports.export');
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const url = new URL(req.url);
  const ciclo = url.searchParams.get('ciclo');
  const status = url.searchParams.get('status');
  const groupId = url.searchParams.get('group_id');
  const conceptId = url.searchParams.get('concept_id');

  let q = supabase.from('v_payment_rows').select('*').order('group_nombre').limit(20000);
  if (ciclo) q = q.eq('ciclo', ciclo);
  if (status) q = q.eq('status', status);
  if (groupId) q = q.eq('group_id', groupId);
  if (conceptId) q = q.eq('concept_id', conceptId);

  const { data, error } = await q.returns<PaymentRow[]>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const filas = (data ?? []).map((r) =>
    [
      r.nombre_alumno,
      r.group_nombre,
      r.concept_nombre,
      r.ciclo,
      r.nombre_tutor,
      r.whatsapp_tutor,
      Number(r.monto_concepto).toFixed(2),
      Number(r.monto_total_cobrado).toFixed(2),
      (Number(r.monto_total_cobrado) - Number(r.monto_concepto)).toFixed(2),
      r.status,
      r.metodo_pago ?? '',
      formatFecha(r.fecha_vencimiento),
      r.fecha_pago ? formatFecha(r.fecha_pago) : '',
      r.mp_payment_id ?? '',
    ]
      .map(escapar)
      .join(','),
  );

  const csv = '﻿' + [COLUMNAS.join(','), ...filas].join('\n');
  const nombre = `kolek-${ciclo ?? 'todos'}-${status ?? 'todos'}.csv`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nombre}"`,
      'Cache-Control': 'no-store',
    },
  });
}
