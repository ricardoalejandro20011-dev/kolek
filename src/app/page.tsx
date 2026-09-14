import Link from 'next/link';
import {
  ArrowRight,
  Baby,
  Building2,
  CalendarClock,
  CheckCircle2,
  FileSpreadsheet,
  GraduationCap,
  Languages,
  Link2,
  MessageCircle,
  RefreshCw,
} from 'lucide-react';
import { SiteNav } from '@/components/marketing/site-nav';
import { SiteFooter } from '@/components/marketing/site-footer';
import { DashboardPreview } from '@/components/marketing/dashboard-preview';
import { PricingCards, PricingMedida, PricingNota } from '@/components/marketing/pricing';
import { Faq, type FaqItem } from '@/components/marketing/faq';
import { Button } from '@/components/ui/button';
import { brand } from '@/config/brand';

/* ────────────────────────────────────────────────────────────────────────
   Datos de la landing
   ──────────────────────────────────────────────────────────────────────── */

const BENEFICIOS = [
  {
    Icon: Link2,
    titulo: 'Genera todos los cobros del mes',
    texto: 'Un clic crea el cargo de cada alumno activo, con su link de pago listo.',
  },
  {
    Icon: MessageCircle,
    titulo: 'Recuerda sin perseguir',
    texto: 'Los recordatorios por WhatsApp salen solos, sin que nadie los escriba a mano.',
  },
  {
    Icon: RefreshCw,
    titulo: 'Concilia automáticamente',
    texto: 'Cuando el tutor paga, el pago se marca solo. Nadie captura nada.',
  },
];

const TIPOS = [
  { Icon: Baby, label: 'Estancias y kínder' },
  { Icon: Building2, label: 'Primarias y secundarias' },
  { Icon: GraduationCap, label: 'Preparatorias y universidades' },
  { Icon: Languages, label: 'Academias, cursos y deportivos' },
];

const PASOS = [
  {
    n: '01',
    titulo: 'Carga tu escuela',
    texto: 'Grupos, conceptos y alumnos — con el nombre que uses de verdad, o por CSV.',
    Icon: FileSpreadsheet,
  },
  {
    n: '02',
    titulo: 'Genera el ciclo',
    texto: `Eliges concepto y mes. ${brand.name} crea el cobro de cada alumno con su link.`,
    Icon: Link2,
  },
  {
    n: '03',
    titulo: 'Manda y olvídate',
    texto: 'Se envía por WhatsApp y se concilia solo cuando el tutor paga.',
    Icon: MessageCircle,
  },
];

const FAQS: FaqItem[] = [
  {
    q: `¿${brand.name} reemplaza mi sistema escolar?`,
    a: <p>No. {brand.positioning} No tocamos calificaciones, asistencia ni el resto de tu operación académica — solo la cobranza.</p>,
  },
  {
    q: '¿El dinero llega directamente a mi escuela?',
    a: <p>Sí. Conectas tu propia cuenta con el proveedor de pagos y el dinero cae ahí. {brand.name} nunca lo concentra.</p>,
  },
  {
    q: '¿Necesito WhatsApp Business API?',
    a: <p>No para empezar. Sin ella, cada mensaje queda listo para mandarse a mano en un clic.</p>,
  },
  {
    q: '¿Puedo registrar pagos por transferencia o efectivo?',
    a: <p>Sí, en cualquier momento, con nota y quién lo registró. Queda separado de los pagos en línea.</p>,
  },
  {
    q: '¿Existe contrato forzoso?',
    a: <p>No. Es mes a mes o anual, y puedes exportar tu información antes de cancelar.</p>,
  },
];

/* ────────────────────────────────────────────────────────────────────────
   Página
   ──────────────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white pb-16 md:pb-0">
      <SiteNav />

      <main>
        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 grid-bg fade-mask-b opacity-70" />
          <div className="relative mx-auto w-full max-w-[1180px] px-6 pb-20 pt-14 md:pt-20">
            <div className="grid items-start gap-12 lg:grid-cols-12 lg:gap-8">
              {/* Copy — 5 columnas */}
              <div className="animate-fade-up lg:col-span-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#111111]/10 bg-white px-3 py-1 shadow-subtle">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[12px] text-muted-foreground">Cobranza escolar automatizada</span>
                </div>

                <h1 className="mt-6 text-[2.6rem] font-[640] leading-[1.03] tracking-[-0.042em] text-ink sm:text-[3.1rem]">
                  Cobra colegiaturas a tiempo, sin perseguir pagos.
                </h1>

                <p className="mt-6 max-w-[46ch] text-[15px] leading-relaxed text-muted-foreground">
                  {brand.name} genera los cobros del mes, prepara recordatorios por WhatsApp y
                  concilia cada pago. Tú sabes quién pagó, quién está por vencer y quién necesita
                  seguimiento.
                </p>

                <p className="mt-3 max-w-[46ch] text-[13px] leading-relaxed text-ink/70">
                  {brand.positioning}
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Button asChild size="lg" variant="brand">
                    <Link href="/demo">
                      Solicitar demo
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link href="/#como">Ver cómo funciona</Link>
                  </Button>
                </div>

                <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
                  15 minutos · Sin compromiso · Sin tarjeta
                </p>

                {/* Trust row */}
                <ul className="mt-10 grid max-w-[46ch] grid-cols-2 gap-x-4 gap-y-2.5">
                  {[
                    'Cobranza preventiva',
                    'Conciliación automática',
                    'Dinero directo a tu escuela',
                    'Hecho para México',
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-1.5 text-[12px] text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Preview — 7 columnas */}
              <div className="animate-fade-up lg:col-span-7 lg:-mr-24 xl:-mr-32">
                <DashboardPreview />
              </div>
            </div>
          </div>
        </section>

        {/* ── TRES BENEFICIOS ─────────────────────────────────────────── */}
        <section id="beneficios" className="scroll-mt-20 border-y border-[#111111]/[0.08] bg-[#111111]/[0.015]">
          <div className="mx-auto w-full max-w-[1180px] px-6 py-20">
            <div className="grid gap-4 sm:grid-cols-3">
              {BENEFICIOS.map((b) => (
                <div key={b.titulo} className="rounded-[12px] border border-[#111111]/[0.09] bg-white p-6 shadow-subtle">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#111111]/[0.08] bg-[#111111]/[0.02]">
                    <b.Icon className="h-4 w-4 text-brand-600" strokeWidth={1.7} />
                  </span>
                  <h3 className="mt-4 text-[15px] font-semibold tracking-[-0.012em]">{b.titulo}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{b.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CÓMO FUNCIONA ───────────────────────────────────────────── */}
        <section id="como" className="scroll-mt-20">
          <div className="mx-auto w-full max-w-[1180px] px-6 py-24">
            <div className="max-w-[52ch]">
              <p className="eyebrow">Cómo funciona</p>
              <h2 className="mt-4 text-display-md text-ink">Tres pasos, una vez al mes.</h2>
            </div>

            <div className="mt-14 grid gap-px overflow-hidden rounded-[12px] border border-[#111111]/[0.09] bg-[#111111]/[0.08] md:grid-cols-3">
              {PASOS.map((p) => (
                <div key={p.n} className="flex flex-col bg-white p-8">
                  <div className="flex items-center justify-between">
                    <span className="tnum text-[11px] font-semibold tracking-[0.14em] text-brand-600">{p.n}</span>
                    <p.Icon className="h-4 w-4 text-[#111111]/25" strokeWidth={1.6} />
                  </div>
                  <h3 className="mt-8 text-[17px] font-semibold leading-snug tracking-[-0.015em]">{p.titulo}</h3>
                  <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{p.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TIPOS DE INSTITUCIÓN ────────────────────────────────────── */}
        <section id="tipos" className="scroll-mt-20 border-y border-[#111111]/[0.08] bg-[#111111]/[0.015]">
          <div className="mx-auto w-full max-w-[1180px] px-6 py-16">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-12">
              <p className="shrink-0 max-w-[22ch] text-[12px] leading-relaxed text-muted-foreground">
                Para cualquier institución que cobre mensualidades en México
              </p>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                {TIPOS.map(({ Icon, label }) => (
                  <div key={label} className="inline-flex items-center gap-2 text-ink/70">
                    <Icon className="h-4 w-4" strokeWidth={1.6} />
                    <span className="text-[13px] font-medium">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── CONFIANZA ───────────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-[1180px] px-6 py-24">
          <div className="mx-auto max-w-[54ch] text-center">
            <p className="eyebrow">Confianza</p>
            <h2 className="mt-4 text-display-md text-ink">Tu dinero llega directo a tu escuela.</h2>
            <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">
              Los pagos se procesan en la cuenta conectada por cada institución. {brand.name} no
              concentra el dinero de las escuelas. Mercado Pago está disponible como proveedor de
              pagos.
            </p>
          </div>
        </section>

        {/* ── PLANES ──────────────────────────────────────────────────── */}
        <section id="planes" className="scroll-mt-20 border-y border-[#111111]/[0.08] bg-[#111111]/[0.015]">
          <div className="mx-auto w-full max-w-[1180px] px-6 py-24">
            <div className="max-w-[46ch]">
              <p className="eyebrow">Planes</p>
              <h2 className="mt-4 text-display-md text-ink">Por número de alumnos.</h2>
            </div>
            <div className="mt-12">
              <PricingCards ctaHref="/demo" />
              <PricingMedida />
              <PricingNota />
            </div>
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────────── */}
        <section id="faq" className="scroll-mt-20">
          <div className="mx-auto w-full max-w-[1180px] px-6 py-24">
            <div className="grid gap-12 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <p className="eyebrow">Preguntas frecuentes</p>
                <h2 className="mt-4 text-display-sm text-ink">Lo que preguntan antes de firmar.</h2>
              </div>
              <div className="lg:col-span-8">
                <Faq items={FAQS} />
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA FINAL ───────────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-[1180px] px-6 py-24">
          <div className="relative overflow-hidden rounded-[12px] border border-[#111111]/[0.09] bg-ink px-8 py-14 sm:px-14">
            <div
              className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-500/25 blur-3xl"
              aria-hidden
            />
            <div className="relative grid gap-8 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-7">
                <h2 className="text-[2rem] font-[640] leading-[1.1] tracking-[-0.035em] text-white sm:text-[2.4rem]">
                  Haz que el próximo día de cobro sea diferente.
                </h2>
                <p className="mt-4 max-w-[48ch] text-[15px] leading-relaxed text-white/65">
                  Conoce cómo {brand.name} puede adaptarse a los alumnos, grupos y conceptos de tu
                  institución.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 lg:col-span-5 lg:justify-end">
                <Button asChild size="lg" variant="brand">
                  <Link href="/demo">
                    Solicitar demo
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/20 bg-transparent text-white hover:bg-white/10"
                >
                  <Link href="/planes">
                    <CalendarClock className="h-4 w-4" />
                    Ver planes
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />

      {/* CTA sticky discreto en móvil */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#111111]/[0.08] bg-white/95 p-3 backdrop-blur-md md:hidden">
        <Button asChild variant="brand" className="w-full" size="lg">
          <Link href="/demo">Solicitar demo</Link>
        </Button>
      </div>
    </div>
  );
}
