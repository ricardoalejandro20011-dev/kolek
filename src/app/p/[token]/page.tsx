import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { CheckCircle2, Clock, FlaskConical, Info, RotateCcw, TriangleAlert, XCircle } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { asegurarIntentoDeCobro } from '@/lib/payments';
import { CheckoutBrick } from '@/components/pago/checkout-brick';
import { SimulatePanel } from '@/components/pago/simulate-panel';
import { LogoMark } from '@/components/brand/logo';
import { brand } from '@/config/brand';
import { Badge } from '@/components/ui/badge';
import { desglose, formatMXN } from '@/lib/fees';
import { cicloLabel, formatFecha, formatFechaHora } from '@/lib/utils';
import type { School } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pago de colegiatura',
  robots: { index: false, follow: false },
};

interface PagoPublico {
  id: string;
  school_id: string;
  student_id: string;
  concept_id: string;
  ciclo: string;
  monto_concepto: number;
  monto_total_cobrado: number;
  status: string;
  fecha_pago: string | null;
  fecha_vencimiento: string;
  link_token: string;
  metodo_pago: string | null;
  students: {
    nombre_alumno: string;
    nombre_tutor: string;
    email_tutor: string | null;
    groups: { nombre: string } | null;
  } | null;
  concepts: { nombre: string } | null;
}

export default async function PagoPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { estado?: string };
}) {
  // El tutor no está autenticado: leemos con service_role filtrando por el
  // link_token (uuid v4, no adivinable). RLS sigue cerrado para `anon`.
  const db = createAdminClient();

  const { data: pago } = await db
    .from('payments')
    .select(
      `id, school_id, student_id, concept_id, ciclo, monto_concepto, monto_total_cobrado, status,
       fecha_pago, fecha_vencimiento, link_token, metodo_pago,
       students ( nombre_alumno, nombre_tutor, email_tutor, groups ( nombre ) ),
       concepts ( nombre )`,
    )
    .eq('link_token', params.token)
    .maybeSingle<PagoPublico>();

  if (!pago) notFound();

  const { data: school } = await db
    .from('schools')
    .select('*')
    .eq('id', pago.school_id)
    .maybeSingle<School>();

  if (!school) notFound();

  const alumno = pago.students;
  const concepto = pago.concepts?.nombre ?? 'Pago';
  const d = desglose(Number(pago.monto_concepto));
  const yaPagado = pago.status === 'pagado';
  const vencido = pago.status === 'atrasado';
  const cancelado = pago.status === 'cancelado';
  const reembolsado = pago.status === 'reembolsado';
  const disputado = pago.status === 'disputado';
  const procesando = pago.status === 'procesando';

  // Intento de cobro perezoso: si no se creó al generar el ciclo, se crea al abrirse.
  let providerId: string | null = null;
  let providerReference: string | null = null;
  let publicKey: string | null = null;
  let errorProveedor: string | null = null;

  if (!yaPagado && !cancelado && !reembolsado) {
    const r = await asegurarIntentoDeCobro(db, pago, school, {
      conceptoNombre: concepto,
      alumnoNombre: alumno?.nombre_alumno ?? 'Alumno',
      studentId: pago.student_id,
      conceptId: pago.concept_id,
      tutorNombre: alumno?.nombre_tutor,
      tutorEmail: alumno?.email_tutor,
    });
    providerId = r.providerId;
    // Para el Wallet Brick de Mercado Pago se necesita el ID de la
    // preference (providerReference), NO la URL de checkout hospedado.
    providerReference = r.providerReference;
    publicKey = r.publicKey;
    errorProveedor = r.error;
  }

  const modoDemo = providerId === 'mock';

  return (
    <div className="flex min-h-screen flex-col bg-[#111111]/[0.015]">
      <main className="mx-auto w-full max-w-[520px] flex-1 px-5 py-10 sm:py-16">
        {modoDemo && (
          <div className="mb-4 flex items-center gap-2 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2">
            <FlaskConical className="h-3.5 w-3.5 shrink-0 text-amber-700" />
            <p className="text-[11px] font-medium text-amber-900">
              Modo de prueba — {brand.name} sandbox. Ningún cargo aquí es real.
            </p>
          </div>
        )}

        {/* Escuela */}
        <div className="flex items-center gap-3">
          {school.logo_url ? (
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[12px] border border-[#111111]/[0.09] bg-white">
              <Image
                src={school.logo_url}
                alt={school.name}
                width={48}
                height={48}
                className="h-full w-full object-contain"
                unoptimized
              />
            </div>
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-[12px] border border-[#111111]/[0.09] bg-white">
              <LogoMark className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold tracking-[-0.015em] text-ink">
              {school.name}
            </p>
            <p className="text-[12px] text-muted-foreground">Pago en línea seguro</p>
          </div>
        </div>

        {/* Tarjeta */}
        <div className="mt-6 overflow-hidden rounded-[12px] border border-[#111111]/[0.09] bg-white shadow-card">
          {/* Estado */}
          {yaPagado ? (
            <div className="flex items-start gap-3 border-b border-emerald-200 bg-emerald-50 px-6 py-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-[14px] font-semibold text-emerald-900">Este pago ya está cubierto</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-emerald-800/80">
                  Registrado el {formatFechaHora(pago.fecha_pago)}
                  {pago.metodo_pago === 'manual' ? ' directamente en la escuela.' : '.'} No
                  necesitas hacer nada más.
                </p>
              </div>
            </div>
          ) : reembolsado ? (
            <div className="flex items-start gap-3 border-b border-slate-200 bg-slate-50 px-6 py-4">
              <RotateCcw className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />
              <div>
                <p className="text-[14px] font-semibold text-slate-900">Pago reembolsado</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-slate-700/80">
                  El monto fue devuelto. Si esperabas que siguiera activo, contacta a {school.name}.
                </p>
              </div>
            </div>
          ) : cancelado ? (
            <div className="flex items-start gap-3 border-b border-slate-200 bg-slate-50 px-6 py-4">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />
              <div>
                <p className="text-[14px] font-semibold text-slate-900">Este cobro fue cancelado</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-slate-700/80">
                  La escuela canceló este cargo. Contáctala si crees que es un error.
                </p>
              </div>
            </div>
          ) : disputado ? (
            <div className="flex items-start gap-3 border-b border-red-200 bg-red-50 px-6 py-4">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="text-[14px] font-semibold text-red-900">Pago en disputa</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-red-800/80">
                  Este cargo está en revisión. La escuela te contactará con más información.
                </p>
              </div>
            </div>
          ) : procesando || searchParams.estado === 'pending' ? (
            <div className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-6 py-4">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-[14px] font-semibold text-amber-900">Pago en proceso</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-amber-800/80">
                  El proveedor todavía está confirmando. En cuanto se apruebe, la escuela lo ve
                  reflejado automáticamente.
                </p>
              </div>
            </div>
          ) : searchParams.estado === 'failure' ? (
            <div className="flex items-start gap-3 border-b border-red-200 bg-red-50 px-6 py-4">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="text-[14px] font-semibold text-red-900">El pago no se completó</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-red-800/80">
                  No se te hizo ningún cargo. Puedes intentar de nuevo con otro método abajo.
                </p>
              </div>
            </div>
          ) : vencido ? (
            <div className="flex items-start gap-3 border-b border-red-200 bg-red-50 px-6 py-4">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="text-[14px] font-semibold text-red-900">Pago vencido</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-red-800/80">
                  La fecha límite era el {formatFecha(pago.fecha_vencimiento)}. Todavía puedes
                  pagarlo aquí.
                </p>
              </div>
            </div>
          ) : null}

          {/* Detalle */}
          <div className="px-6 py-6">
            <p className="eyebrow">{concepto}</p>
            <h1 className="mt-2 text-[22px] font-semibold tracking-[-0.025em] text-ink">
              {cicloLabel(pago.ciclo)}
            </h1>

            <dl className="mt-5 space-y-2.5 border-t border-[#111111]/[0.07] pt-5">
              <div className="flex justify-between gap-4">
                <dt className="text-[13px] text-muted-foreground">Alumno</dt>
                <dd className="text-right text-[13px] font-medium text-ink">
                  {alumno?.nombre_alumno ?? '—'}
                  {alumno?.groups?.nombre ? (
                    <span className="font-normal text-muted-foreground">
                      {' '}
                      · {alumno.groups.nombre}
                    </span>
                  ) : null}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[13px] text-muted-foreground">Tutor</dt>
                <dd className="text-right text-[13px] text-ink">{alumno?.nombre_tutor ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[13px] text-muted-foreground">Fecha de vencimiento</dt>
                <dd className="tnum text-right text-[13px] text-ink">
                  {formatFecha(pago.fecha_vencimiento)}
                </dd>
              </div>
            </dl>

            {/* Desglose */}
            <div className="mt-6 rounded-[12px] border border-[#111111]/[0.09] bg-[#111111]/[0.015] p-5">
              <div className="space-y-2.5">
                <div className="flex justify-between">
                  <span className="text-[13px] text-muted-foreground">{concepto}</span>
                  <span className="tnum text-[14px] text-ink">{formatMXN(d.concepto)}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-muted-foreground">
                    Costo de procesamiento
                  </span>
                  <span className="tnum text-[14px] text-ink">{formatMXN(d.comision)}</span>
                </div>
                <div className="flex items-baseline justify-between border-t border-[#111111]/[0.09] pt-3">
                  <span className="text-[14px] font-medium text-ink">Total a pagar</span>
                  <span className="tnum text-[26px] font-semibold tracking-[-0.03em] text-ink">
                    {formatMXN(d.total)}
                  </span>
                </div>
              </div>

              <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                {school.name} decidió que el tutor absorbe el costo de procesamiento. La escuela
                recibe {formatMXN(d.concepto)} íntegros.
              </p>
            </div>

            {/* Botón de pago */}
            {!yaPagado && !cancelado && !reembolsado && (
              <div className="mt-6">
                {modoDemo ? (
                  <SimulatePanel token={pago.link_token} />
                ) : providerReference && publicKey ? (
                  <CheckoutBrick preferenceId={providerReference} publicKey={publicKey} />
                ) : (
                  <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
                    <p className="font-medium">El pago en línea no está disponible ahora</p>
                    <p className="mt-1 text-[12px] text-amber-900/80">
                      {errorProveedor ?? 'Intenta de nuevo en unos minutos.'} Contacta a{' '}
                      {school.name}
                      {school.whatsapp ? ` al ${school.whatsapp}` : ''} para pagar por otro medio.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pie */}
          <div className="flex items-center justify-between border-t border-[#111111]/[0.07] bg-[#111111]/[0.015] px-6 py-3">
            <Badge variant={yaPagado ? 'pagado' : vencido ? 'atrasado' : 'pendiente'}>
              {yaPagado
                ? 'Pagado'
                : reembolsado
                  ? 'Reembolsado'
                  : cancelado
                    ? 'Cancelado'
                    : disputado
                      ? 'En disputa'
                      : procesando
                        ? 'Procesando'
                        : vencido
                          ? 'Vencido'
                          : 'Pendiente'}
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              Folio {pago.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
        </div>

        {/* Recibo / estado de cuenta */}
        {yaPagado && (
          <div className="mt-3 flex flex-wrap gap-3 text-[12px]">
            <a
              href={`/recibo/${pago.link_token}`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand-600 hover:underline"
            >
              Ver / descargar recibo
            </a>
          </div>
        )}

        {/* Firma */}
        <p className="mt-6 flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground">
          Cobranza gestionada con
          <LogoMark className="h-3.5 w-3.5" />
          <span className="font-medium text-ink">{brand.name}</span>
        </p>
      </main>
    </div>
  );
}
