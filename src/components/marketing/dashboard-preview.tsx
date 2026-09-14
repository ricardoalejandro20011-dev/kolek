import { Check, Clock, TriangleAlert } from 'lucide-react';
import { LogoMark } from '@/components/brand/logo';
import { brand } from '@/config/brand';
import { calcTotalConComision, formatMXN, formatMXNCompact } from '@/lib/fees';
import { cn } from '@/lib/utils';

/**
 * Preview del dashboard real, simplificado a propósito para el hero:
 * 3 KPIs y un puñado de alumnos de demostración — no la tabla completa.
 * Los datos son 100% simulados (ver aviso de simulación abajo).
 */

const FILAS = [
  { alumno: 'Renata Ibarra Solís', grupo: '3ro B', monto: 2450, estado: 'pagado' },
  { alumno: 'Emiliano Cárdenas', grupo: '1ro A', monto: 2450, estado: 'pendiente' },
  { alumno: 'Santiago Ledezma', grupo: '2do A', monto: 1960, estado: 'atrasado' },
  { alumno: 'Valentina Ochoa', grupo: '6to B', monto: 2450, estado: 'pagado' },
] as const;

const ESTADO_UI = {
  pagado: { label: 'Pagado', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700', Icon: Check },
  pendiente: { label: 'Pendiente', cls: 'border-amber-200 bg-amber-50 text-amber-700', Icon: Clock },
  atrasado: { label: 'Atrasado', cls: 'border-red-200 bg-red-50 text-red-700', Icon: TriangleAlert },
} as const;

function Kpi({ label, value, acento }: { label: string; value: string; acento?: boolean }) {
  return (
    <div className="min-w-0 flex-1 px-4 py-3">
      <p className="truncate text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'tnum mt-1 text-[19px] font-semibold tracking-[-0.02em]',
          acento ? 'text-brand-600' : 'text-ink',
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function DashboardPreview({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-[12px] border border-[#111111]/[0.09] bg-white shadow-float',
        className,
      )}
      aria-label={`Vista previa del dashboard de ${brand.name} — simulación con datos demostrativos`}
    >
      {/* Aviso de simulación */}
      <div className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-amber-800">
          Simulación · Datos demostrativos
        </span>
      </div>

      {/* Barra superior */}
      <div className="flex items-center gap-3 border-b border-[#111111]/[0.07] px-4 py-2.5">
        <LogoMark className="h-4 w-4" />
        <span className="text-[12px] font-semibold tracking-[-0.01em]">Escuela Demo</span>
        <span className="rounded-full border border-[#111111]/10 px-2 py-0.5 text-[10px] text-muted-foreground">
          Primaria
        </span>
      </div>

      {/* KPIs */}
      <div className="flex divide-x divide-[#111111]/[0.07] border-b border-[#111111]/[0.07]">
        <Kpi label="Cobrado" value={formatMXNCompact(451820)} acento />
        <Kpi label="Pendiente" value={formatMXNCompact(72480)} />
        <Kpi label="Morosidad" value="7.4%" />
      </div>

      {/* Filas de alumnos */}
      <ul className="divide-y divide-[#111111]/[0.05]">
        {FILAS.map((f) => {
          const ui = ESTADO_UI[f.estado];
          return (
            <li key={f.alumno} className="flex items-center gap-3 px-4 py-2.5 text-[12px]">
              <span className="min-w-0 flex-1 truncate font-medium text-ink">{f.alumno}</span>
              <span className="hidden text-muted-foreground sm:inline">{f.grupo}</span>
              <span className="tnum w-20 text-right text-muted-foreground">
                {formatMXN(calcTotalConComision(f.monto))}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
                  ui.cls,
                )}
              >
                <ui.Icon className="h-2.5 w-2.5" strokeWidth={2.5} />
                {ui.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
