import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { LogoMark } from '@/components/brand/logo';
import { brand } from '@/config/brand';
import { desglose, formatMXN } from '@/lib/fees';
import { cicloLabel, formatFecha, formatFechaHora } from '@/lib/utils';
import { PrintButton } from './print-button';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Recibo de pago', robots: { index: false, follow: false } };

export default async function ReciboPage({ params }: { params: { token: string } }) {
  const db = createAdminClient();
  const { data: pago } = await db
    .from('payments')
    .select(
      `id, ciclo, monto_concepto, status, fecha_pago, metodo_pago, mp_payment_id, nota_manual,
       students ( nombre_alumno, nombre_tutor ),
       concepts ( nombre ),
       schools ( name, rfc )`,
    )
    .eq('link_token', params.token)
    .maybeSingle<{
      id: string;
      ciclo: string;
      monto_concepto: number;
      status: string;
      fecha_pago: string | null;
      metodo_pago: string | null;
      mp_payment_id: string | null;
      nota_manual: string | null;
      students: { nombre_alumno: string; nombre_tutor: string } | null;
      concepts: { nombre: string } | null;
      schools: { name: string; rfc: string | null } | null;
    }>();

  if (!pago || pago.status !== 'pagado') notFound();

  const d = desglose(Number(pago.monto_concepto));
  const referencia = pago.mp_payment_id ?? pago.nota_manual ?? '—';
  const metodoLabel =
    pago.metodo_pago === 'manual' ? 'Efectivo / transferencia' : pago.metodo_pago === 'mock' ? 'Simulado (modo prueba)' : 'Pago en línea';

  return (
    <div className="mx-auto min-h-screen max-w-[560px] bg-white px-6 py-10 print:py-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LogoMark className="h-5 w-5" />
          <span className="text-[14px] font-semibold text-ink">{brand.name}</span>
        </div>
        <PrintButton />
      </div>

      <div className="mt-8 rounded-[12px] border border-[#111111]/[0.1] p-7">
        <p className="eyebrow">Recibo de pago</p>
        <h1 className="mt-2 text-[20px] font-semibold tracking-[-0.02em] text-ink">
          Folio {pago.id.slice(0, 8).toUpperCase()}
        </h1>

        <dl className="mt-6 space-y-2.5 border-t border-[#111111]/[0.08] pt-5 text-[13px]">
          {[
            ['Escuela', pago.schools?.name ?? '—'],
            ['Alumno', pago.students?.nombre_alumno ?? '—'],
            ['Tutor', pago.students?.nombre_tutor ?? '—'],
            ['Concepto', pago.concepts?.nombre ?? '—'],
            ['Periodo', cicloLabel(pago.ciclo)],
            ['Fecha de pago', formatFechaHora(pago.fecha_pago)],
            ['Método', metodoLabel],
            ['Referencia', referencia],
            ['Estado', 'Pagado'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 space-y-2 border-t border-[#111111]/[0.08] pt-5">
          <div className="flex justify-between text-[13px]">
            <span className="text-muted-foreground">Concepto</span>
            <span className="tnum text-ink">{formatMXN(d.concepto)}</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-muted-foreground">Costo de procesamiento</span>
            <span className="tnum text-ink">{formatMXN(d.comision)}</span>
          </div>
          <div className="flex justify-between border-t border-[#111111]/[0.08] pt-2.5 text-[14px] font-semibold">
            <span>Total pagado</span>
            <span className="tnum">{formatMXN(d.total)}</span>
          </div>
        </div>

        <p className="mt-6 rounded-[10px] bg-[#111111]/[0.03] px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
          Este comprobante no sustituye una factura CFDI. Si tu escuela emite factura, solicítala
          directamente con ella usando esta referencia de pago.
        </p>
      </div>

      <p className="mt-6 text-center text-[11px] text-muted-foreground print:hidden">
        Generado por {brand.name} · {formatFecha(new Date().toISOString())}
      </p>
    </div>
  );
}
