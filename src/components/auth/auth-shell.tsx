import Link from 'next/link';
import { Check } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { brand } from '@/config/brand';

/**
 * Layout partido asimétrico para login/registro/demo: formulario a la
 * izquierda, argumento de venta a la derecha. Nada de tarjeta centrada.
 *
 * Por diseño, el panel default NUNCA menciona la comisión de procesamiento
 * ni jerga técnica (RLS, school_id): quien todavía no tiene cuenta no
 * necesita esos detalles para decidir registrarse.
 */
export function AuthShell({
  titulo,
  subtitulo,
  children,
  pie,
  panel,
}: {
  titulo: string;
  subtitulo: string;
  children: React.ReactNode;
  pie?: React.ReactNode;
  /** Reemplaza el panel derecho default por completo. */
  panel?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      {/* Formulario */}
      <div className="flex flex-col px-6 py-10 sm:px-12 lg:px-16">
        <Link href="/" className="inline-flex w-fit" aria-label={`${brand.name} — inicio`}>
          <Logo />
        </Link>

        <div className="flex flex-1 items-center">
          <div className="w-full max-w-[400px] py-12">
            <h1 className="text-display-sm text-ink">{titulo}</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{subtitulo}</p>
            <div className="mt-8">{children}</div>
            {pie ? <div className="mt-6 text-[13px] text-muted-foreground">{pie}</div> : null}
          </div>
        </div>

        <p className="text-[12px] text-muted-foreground">
          © {new Date().getFullYear()} {brand.name} · {brand.tagline}.
        </p>
      </div>

      {/* Panel lateral */}
      <aside className="relative hidden overflow-hidden border-l border-[#111111]/[0.08] bg-[#111111]/[0.015] lg:block">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-60" />
        <div className="relative flex h-full flex-col justify-center px-14">
          {panel ?? <PanelDefault />}
        </div>
      </aside>
    </div>
  );
}

function PanelDefault() {
  return (
    <>
      <p className="eyebrow">Por qué las escuelas cambian</p>
      <h2 className="mt-4 max-w-[20ch] text-display-sm text-ink">
        {brand.positioning}
      </h2>
      <ul className="mt-10 space-y-3">
        {[
          'Kínder, primaria, prepa, universidad o academia',
          'Grupos y conceptos 100 % configurables',
          'Recordatorios por WhatsApp preparados en un clic',
          'Cada escuela ve solo sus propios datos, nunca los de otra',
        ].map((t) => (
          <li key={t} className="flex items-start gap-2.5 text-[13px] text-ink/80">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" strokeWidth={2.6} />
            {t}
          </li>
        ))}
      </ul>
    </>
  );
}
