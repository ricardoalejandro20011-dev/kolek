import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteNav } from '@/components/marketing/site-nav';
import { SiteFooter } from '@/components/marketing/site-footer';
import { brand } from '@/config/brand';

export const metadata: Metadata = { title: 'Política de cancelación' };

export default function CancelacionPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteNav />
      <main className="mx-auto w-full max-w-[760px] px-6 py-16">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-3 text-display-md text-ink">Política de cancelación</h1>

        <div className="mt-10 space-y-8 text-[14px] leading-relaxed text-ink/85">
          <section>
            <h2 className="text-[16px] font-semibold text-ink">Sin contrato forzoso</h2>
            <p className="mt-2">
              Puedes cancelar tu suscripción a {brand.name} cuando quieras, sin penalización.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-ink">Qué pasa al cancelar</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>Dejas de generar cargos y recordatorios nuevos.</li>
              <li>
                Conservas acceso de solo lectura y exportación durante el periodo de gracia
                configurado, para que puedas descargar tu información.
              </li>
              <li>
                El historial de pagos ya procesados no se borra: sigue en la cuenta de tu
                proveedor de pagos, independiente de {brand.name}.
              </li>
              <li>Puedes solicitar la eliminación de tus datos después de exportarlos.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-ink">Reembolsos</h2>
            <p className="mt-2">
              La mensualidad ya cobrada de {brand.name} no es reembolsable de forma automática;
              casos particulares se atienden por{' '}
              <Link href="/contacto" className="text-brand-600 underline underline-offset-2">
                contacto
              </Link>
              . Esto no aplica al dinero de las colegiaturas, que nunca pasa por {brand.name}.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
