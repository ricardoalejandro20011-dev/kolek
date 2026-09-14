import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, CreditCard, MessageCircle } from 'lucide-react';
import { requireSchool } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CobranzaView } from '@/components/dashboard/cobranza-view';
import { GenerateCycleDialog } from '@/components/dashboard/generate-cycle-dialog';
import { KpiRow, calcularKpis } from '@/components/dashboard/kpi-row';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getPaymentProvider } from '@/lib/payments/factory';
import { getWaCreds } from '@/lib/whatsapp';
import { evaluarAcceso, type Subscription } from '@/lib/subscriptions';
import { cicloActual, cicloLabel } from '@/lib/utils';
import type { Concept, Group, PaymentRow, Student } from '@/lib/types';

export const metadata: Metadata = { title: 'Cobranza' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { ciclo?: string };
}) {
  const { school } = await requireSchool();
  const supabase = createClient();

  const ciclo = /^\d{4}-\d{2}$/.test(searchParams.ciclo ?? '')
    ? searchParams.ciclo!
    : cicloActual();

  const [pagosRes, gruposRes, conceptosRes, alumnosRes, subRes] = await Promise.all([
    supabase
      .from('v_payment_rows')
      .select('*')
      .eq('school_id', school.id)
      .eq('ciclo', ciclo)
      .order('nombre_alumno')
      .limit(5000)
      .returns<PaymentRow[]>(),
    supabase.from('groups').select('*').eq('school_id', school.id).order('orden').returns<Group[]>(),
    supabase
      .from('concepts')
      .select('*')
      .eq('school_id', school.id)
      .order('created_at')
      .returns<Concept[]>(),
    supabase
      .from('students')
      .select('id, group_id')
      .eq('school_id', school.id)
      .eq('status', 'activo')
      .returns<Pick<Student, 'id' | 'group_id'>[]>(),
    supabase.from('subscriptions').select('*').eq('school_id', school.id).maybeSingle<Subscription>(),
  ]);

  const pagos = pagosRes.data ?? [];
  const grupos = gruposRes.data ?? [];
  const conceptos = conceptosRes.data ?? [];
  const alumnos = alumnosRes.data ?? [];
  const acceso = evaluarAcceso(subRes.data ?? null);

  const alumnosPorGrupo: Record<string, number> = {};
  for (const a of alumnos) {
    const k = a.group_id ?? 'sin-grupo';
    alumnosPorGrupo[k] = (alumnosPorGrupo[k] ?? 0) + 1;
  }

  const kpis = calcularKpis(pagos, alumnos.length);

  const provider = await getPaymentProvider(school.id);
  const wa = getWaCreds(school);
  const avisos: { tono: 'aviso' | 'info'; texto: string; cta: string; href: string }[] = [];

  if (!acceso.accesoCompleto && acceso.motivo) {
    avisos.push({
      tono: 'aviso',
      texto: `${acceso.motivo}${acceso.soloLecturaYExportacion ? ' Puedes seguir consultando y exportando.' : ''}`,
      cta: 'Ver plan',
      href: '/dashboard/settings',
    });
  }

  if (provider.id === 'mock') {
    avisos.push({
      tono: 'info',
      texto:
        'Kolek está en modo de prueba (sin proveedor de pagos real conectado). Los links de pago se pueden simular de extremo a extremo, pero ningún cobro es real.',
      cta: 'Conectar Mercado Pago',
      href: '/dashboard/settings',
    });
  }

  if (!wa) {
    avisos.push({
      tono: 'info',
      texto:
        'WhatsApp Cloud API no está conectado. Los envíos se guardan en la bitácora listos para mandarse a mano.',
      cta: 'Ver bitácora',
      href: '/dashboard/whatsapp',
    });
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Encabezado */}
      <header className="sticky top-0 z-20 border-b border-[#111111]/[0.08] bg-white/90 px-6 py-4 backdrop-blur-md lg:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-[20px] font-semibold tracking-[-0.025em] text-ink">Cobranza</h1>
            <p className="text-[13px] text-muted-foreground">
              {cicloLabel(ciclo)} · {school.name}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2 lg:hidden">
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/alumnos">Alumnos</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/settings">Ajustes</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-5 px-6 py-6 lg:px-8">
        {/* Avisos de configuración */}
        {avisos.length > 0 && (
          <div className="space-y-2">
            {avisos.map((a) => (
              <div
                key={a.texto}
                className={`flex flex-wrap items-center gap-3 rounded-[12px] border px-4 py-3 ${
                  a.tono === 'aviso'
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-[#111111]/[0.09] bg-[#111111]/[0.02]'
                }`}
              >
                {a.tono === 'aviso' ? (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                ) : (
                  <CreditCard className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <p
                  className={`min-w-[240px] flex-1 text-[13px] leading-relaxed ${
                    a.tono === 'aviso' ? 'text-amber-900' : 'text-muted-foreground'
                  }`}
                >
                  {a.texto}
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link href={a.href}>{a.cta}</Link>
                </Button>
              </div>
            ))}
          </div>
        )}

        {conceptos.length === 0 ? (
          <div className="rounded-[12px] border border-[#111111]/[0.09] bg-white p-6 shadow-subtle">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
              Falta crear al menos un concepto
            </h2>
            <p className="mt-1.5 max-w-[62ch] text-[13px] leading-relaxed text-muted-foreground">
              Un concepto es lo que cobras: Colegiatura, Inscripción, Uniforme, Examen. Sin uno no
              se pueden generar pagos.
            </p>
            <Button asChild variant="brand" size="sm" className="mt-4">
              <Link href="/dashboard/settings#conceptos">Crear conceptos</Link>
            </Button>
          </div>
        ) : (
          <>
            <KpiRow kpis={kpis} />

            <CobranzaView
              rows={pagos}
              grupos={grupos}
              conceptos={conceptos}
              ciclo={ciclo}
              acciones={
                <GenerateCycleDialog
                  schoolId={school.id}
                  grupos={grupos}
                  conceptos={conceptos}
                  cicloActualSel={ciclo}
                  diaVencimiento={school.dia_vencimiento}
                  alumnosPorGrupo={alumnosPorGrupo}
                />
              }
            />
          </>
        )}

        {/* Pie con accesos rápidos */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Badge variant="neutral">
            <MessageCircle className="h-3 w-3" />
            {wa ? 'WhatsApp conectado' : 'WhatsApp en modo manual'}
          </Badge>
          <Badge variant="neutral">
            <CreditCard className="h-3 w-3" />
            {provider.id === 'mercadopago' ? 'Mercado Pago conectado' : 'Modo de prueba (sin proveedor real)'}
          </Badge>
        </div>
      </div>
    </div>
  );
}
