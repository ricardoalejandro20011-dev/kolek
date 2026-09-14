import Link from 'next/link';
import { Check, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PLANES, COMPARATIVA } from '@/lib/plans';
import { cn } from '@/lib/utils';

const MAX_FEATURES_TARJETA = 5;

export function PricingNota() {
  return (
    <p className="mt-6 text-center text-[12px] leading-relaxed text-muted-foreground">
      La mensualidad de Kolek y los costos del proveedor de pagos son independientes. La
      comisión de procesamiento se muestra siempre antes de pagar y cada escuela decide cómo
      manejarla.
    </p>
  );
}

export function PricingCards({ ctaHref = '/registro' }: { ctaHref?: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {PLANES.map((plan) => (
        <div
          key={plan.id}
          className={cn(
            'relative flex flex-col rounded-[12px] border bg-white p-6 transition-shadow',
            plan.popular
              ? 'border-brand-300 shadow-card ring-1 ring-brand-500/15'
              : 'border-[#111111]/[0.09] shadow-subtle hover:shadow-card',
          )}
        >
          {plan.popular && (
            <span className="absolute -top-2.5 left-6 rounded-full bg-brand-500 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white">
              Más popular
            </span>
          )}

          <div className="flex items-baseline justify-between">
            <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{plan.nombre}</h3>
            <span className="text-[11px] text-muted-foreground">{plan.gancho}</span>
          </div>

          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="tnum text-[38px] font-semibold leading-none tracking-[-0.035em]">
              ${plan.precio.toLocaleString('es-MX')}
            </span>
            <span className="text-[13px] text-muted-foreground">MXN + IVA / mes</span>
          </div>

          <p className="mt-3 min-h-[38px] text-[13px] leading-relaxed text-muted-foreground">
            {plan.ideal}
          </p>

          <Button
            asChild
            variant={plan.popular ? 'brand' : 'outline'}
            className="mt-5 w-full"
          >
            <Link href={`${ctaHref}?plan=${plan.id}`}>Empezar con {plan.nombre}</Link>
          </Button>

          <ul className="mt-6 space-y-2.5 border-t border-[#111111]/[0.07] pt-6">
            {plan.features.slice(0, MAX_FEATURES_TARJETA).map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-[13px] leading-snug">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" strokeWidth={2.6} />
                <span className="text-ink/85">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function PricingMedida() {
  return (
    <div className="mt-4 flex flex-col items-start justify-between gap-4 rounded-[12px] border border-[#111111]/[0.09] bg-[#111111]/[0.02] p-6 sm:flex-row sm:items-center">
      <div>
        <h3 className="text-[15px] font-semibold tracking-[-0.01em]">
          ¿Más de 700 alumnos?
        </h3>
        <p className="mt-1 max-w-[60ch] text-[13px] leading-relaxed text-muted-foreground">
          Universidades, sistemas con varios planteles o corporativos educativos: armamos
          un plan a la medida con precio por alumno y onboarding asistido.
        </p>
      </div>
      <Button asChild variant="default" className="shrink-0">
        <Link href="/demo">Hablar con nosotros</Link>
      </Button>
    </div>
  );
}

function Celda({ v }: { v: string | boolean }) {
  if (v === true) {
    return <Check className="mx-auto h-4 w-4 text-brand-500" strokeWidth={2.6} />;
  }
  if (v === false) {
    return <Minus className="mx-auto h-4 w-4 text-[#111111]/18" />;
  }
  return <span className="text-[13px] text-ink/85">{v}</span>;
}

export function PricingComparativa() {
  return (
    <div className="overflow-x-auto thin-scrollbar">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="border-b border-[#111111]/[0.1]">
            <th className="w-[38%] py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Comparativa
            </th>
            {PLANES.map((p) => (
              <th key={p.id} className="px-4 py-3 text-center">
                <span className="text-[13px] font-semibold text-ink">{p.nombre}</span>
                <span className="tnum ml-1.5 text-[12px] text-muted-foreground">
                  ${p.precio.toLocaleString('es-MX')}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARATIVA.map((row) => (
            <tr key={row.feature} className="border-b border-[#111111]/[0.06]">
              <td className="py-3 pr-4 text-[13px] text-ink">{row.feature}</td>
              <td className="px-4 py-3 text-center">
                <Celda v={row.inicio} />
              </td>
              <td className="bg-brand-50/40 px-4 py-3 text-center">
                <Celda v={row.crecimiento} />
              </td>
              <td className="px-4 py-3 text-center">
                <Celda v={row.pro} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
