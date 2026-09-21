import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireSuperadmin } from '@/lib/superadmin';
import { createAdminClient } from '@/lib/supabase/admin';
import { Badge } from '@/components/ui/badge';
import { LogoMark } from '@/components/brand/logo';
import { SchoolActions } from '@/components/superadmin/school-actions';
import { formatCentavos } from '@/lib/money';
import { formatFecha } from '@/lib/utils';
import { PLAN_POR_ID } from '@/lib/plans';
import type { SchoolPlan } from '@/lib/types';

export const metadata: Metadata = { title: 'Panel interno · Kolek' };
export const dynamic = 'force-dynamic';

const ESTADO_BADGE: Record<string, 'pagado' | 'pendiente' | 'atrasado' | 'neutral'> = {
  active: 'pagado',
  trialing: 'pendiente',
  past_due: 'atrasado',
  suspended: 'atrasado',
  canceled: 'neutral',
};

export default async function SuperadminPage() {
  const { email } = await requireSuperadmin();
  const db = createAdminClient();

  const [{ data: schools }, { data: subs }, { data: demoRequests }, { data: webhooksFallidos }] =
    await Promise.all([
      db.from('schools').select('id, name, plan, created_at').order('created_at', { ascending: false }),
      db.from('subscriptions').select('*'),
      db.from('demo_requests').select('id, nombre, escuela, whatsapp, alumnos_aprox, status, created_at').order('created_at', { ascending: false }).limit(20),
      db.from('webhook_events').select('id, provider, event_id, attempts, error, received_at').is('processed_at', null).gt('attempts', 0).limit(20),
    ]);

  const subPorEscuela = new Map((subs ?? []).map((s) => [s.school_id, s]));

  const activas = (subs ?? []).filter((s) => s.status === 'active');
  const enPrueba = (subs ?? []).filter((s) => s.status === 'trialing');
  const vencidas = (subs ?? []).filter((s) => s.status === 'past_due' || s.status === 'suspended');
  const mrrCentavos = activas.reduce((acc, s) => acc + (s.price_centavos ?? 0), 0);
  const arrCentavos = mrrCentavos * 12;

  const demosConvertidas = (demoRequests ?? []).filter((d) => d.status === 'converted').length;
  const conversionDemo = demoRequests?.length ? Math.round((demosConvertidas / demoRequests.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#111111]/[0.015] px-6 py-10 lg:px-10">
      <div className="mx-auto max-w-[1200px]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-6 w-6" />
            <div>
              <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-ink">Panel interno de Kolek</h1>
              <p className="text-[12px] text-muted-foreground">Conectado como {email}</p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#111111]/[0.1] bg-white px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-[#111111]/[0.03]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a mi escuela
          </Link>
        </div>

        {/* KPIs */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {[
            ['Escuelas', String(schools?.length ?? 0)],
            ['Activas', String(activas.length)],
            ['En prueba', String(enPrueba.length)],
            ['Vencidas', String(vencidas.length)],
            ['MRR', formatCentavos(mrrCentavos)],
            ['ARR', formatCentavos(arrCentavos)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[12px] border border-[#111111]/[0.09] bg-white p-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
              <p className="tnum mt-1 text-[18px] font-semibold text-ink">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Solicitudes de demo', String(demoRequests?.length ?? 0)],
            ['Demos convertidas', `${conversionDemo}%`],
            ['Webhooks fallidos', String(webhooksFallidos?.length ?? 0)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[12px] border border-[#111111]/[0.09] bg-white p-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
              <p className="tnum mt-1 text-[18px] font-semibold text-ink">{value}</p>
            </div>
          ))}
        </div>

        {/* Escuelas */}
        <div className="mt-8 rounded-[12px] border border-[#111111]/[0.09] bg-white">
          <div className="border-b border-[#111111]/[0.07] px-5 py-3">
            <h2 className="text-[14px] font-semibold">Escuelas</h2>
          </div>
          {!schools?.length ? (
            <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">
              Todavía no hay ninguna escuela registrada en esta instancia.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#111111]/[0.07] text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                    <th className="px-5 py-2 font-medium">Escuela</th>
                    <th className="px-3 py-2 font-medium">Plan</th>
                    <th className="px-3 py-2 font-medium">Suscripción</th>
                    <th className="px-3 py-2 font-medium">Prueba termina</th>
                    <th className="px-3 py-2 font-medium">Alta</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {schools.map((s) => {
                    const sub = subPorEscuela.get(s.id);
                    return (
                      <tr key={s.id} className="border-b border-[#111111]/[0.05]">
                        <td className="px-5 py-3 font-medium text-ink">{s.name}</td>
                        <td className="px-3 py-3">{PLAN_POR_ID[s.plan as SchoolPlan]?.nombre ?? s.plan}</td>
                        <td className="px-3 py-3">
                          <Badge variant={ESTADO_BADGE[sub?.status ?? ''] ?? 'neutral'}>
                            {sub?.status ?? 'sin suscripción'}
                          </Badge>
                        </td>
                        <td className="tnum px-3 py-3 text-muted-foreground">
                          {sub?.trial_ends_at ? formatFecha(sub.trial_ends_at) : '—'}
                        </td>
                        <td className="tnum px-3 py-3 text-muted-foreground">{formatFecha(s.created_at)}</td>
                        <td className="px-3 py-3 text-right">
                          <SchoolActions schoolId={s.id} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Solicitudes de demo */}
        <div className="mt-6 rounded-[12px] border border-[#111111]/[0.09] bg-white">
          <div className="border-b border-[#111111]/[0.07] px-5 py-3">
            <h2 className="text-[14px] font-semibold">Solicitudes de demo recientes</h2>
          </div>
          {!demoRequests?.length ? (
            <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">Sin solicitudes todavía.</p>
          ) : (
            <ul className="divide-y divide-[#111111]/[0.06]">
              {demoRequests.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13px]">
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">{d.escuela}</span>
                  <span className="text-muted-foreground">{d.nombre}</span>
                  <span className="tnum text-muted-foreground">{d.whatsapp}</span>
                  <Badge variant="outline">{d.alumnos_aprox}</Badge>
                  <Badge variant="neutral">{d.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Webhooks fallidos */}
        <div className="mt-6 rounded-[12px] border border-[#111111]/[0.09] bg-white">
          <div className="border-b border-[#111111]/[0.07] px-5 py-3">
            <h2 className="text-[14px] font-semibold">Salud de integraciones — webhooks con errores</h2>
          </div>
          {!webhooksFallidos?.length ? (
            <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">
              Sin webhooks fallidos pendientes.
            </p>
          ) : (
            <ul className="divide-y divide-[#111111]/[0.06]">
              {webhooksFallidos.map((w) => (
                <li key={w.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[12px]">
                  <Badge variant="atrasado">{w.provider}</Badge>
                  <span className="tnum text-muted-foreground">{w.event_id}</span>
                  <span className="text-red-700">{w.error}</span>
                  <span className="ml-auto text-muted-foreground">{w.attempts} intentos</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
