import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteNav } from '@/components/marketing/site-nav';
import { SiteFooter } from '@/components/marketing/site-footer';
import { brand } from '@/config/brand';
import { PLANES } from '@/lib/plans';

export const metadata: Metadata = { title: 'Términos y condiciones' };

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteNav />
      <main className="mx-auto w-full max-w-[760px] px-6 py-16">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-3 text-display-md text-ink">Términos y condiciones</h1>
        <p className="mt-3 text-[13px] text-muted-foreground">
          Última actualización: {new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long' })}
        </p>

        <div className="mt-10 space-y-8 text-[14px] leading-relaxed text-ink/85">
          <section>
            <h2 className="text-[16px] font-semibold text-ink">1. Qué es {brand.name}</h2>
            <p className="mt-2">
              {brand.name} es un software como servicio (SaaS) de cobranza escolar preventiva,
              operado por {brand.parentCompany}. {brand.name} centraliza colegiaturas, automatiza
              recordatorios y concilia pagos. {brand.name} no es un ERP escolar ni reemplaza el
              sistema académico de la institución.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-ink">2. El dinero de las colegiaturas</h2>
            <p className="mt-2">
              {brand.name} nunca concentra el dinero de las escuelas. Cada escuela conecta su
              propia cuenta con el proveedor de pagos (hoy, Mercado Pago) y los cobros se
              depositan directamente ahí. La mensualidad que la escuela le paga a {brand.name} es
              independiente del dinero de las colegiaturas.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-ink">3. Planes y suscripción</h2>
            <p className="mt-2">
              {brand.name} se cobra por suscripción mensual o anual, según el plan contratado
              ({PLANES.map((p) => p.nombre).join(', ')}, o un plan a la medida para más de{' '}
              {PLANES[PLANES.length - 1]?.limite ?? 700} alumnos). Los precios vigentes se
              publican en{' '}
              <Link href="/planes" className="text-brand-600 underline underline-offset-2">
                /planes
              </Link>{' '}
              y no incluyen el costo de procesamiento de pagos, que cobra el proveedor de pagos
              de forma independiente.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-ink">4. Prueba gratuita</h2>
            <p className="mt-2">
              Toda cuenta nueva inicia con un periodo de prueba. Al terminar, la escuela puede
              activar su suscripción; si no lo hace, la cuenta conserva acceso de solo lectura y
              exportación durante un periodo de gracia antes de suspenderse.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-ink">5. Responsabilidad de la escuela</h2>
            <p className="mt-2">
              La escuela es responsable de la exactitud de los datos que captura (montos,
              alumnos, tutores) y de cumplir sus propias obligaciones fiscales y de protección de
              datos frente a las familias. {brand.name} provee la herramienta; la relación
              contractual de cobranza es entre la escuela y sus familias.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-ink">6. Cancelación</h2>
            <p className="mt-2">
              Sin contrato forzoso: la escuela puede cancelar su suscripción cuando quiera. Ver el
              detalle en{' '}
              <Link href="/cancelacion" className="text-brand-600 underline underline-offset-2">
                Política de cancelación
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-ink">7. Disponibilidad y cambios</h2>
            <p className="mt-2">
              {brand.name} está en desarrollo activo. Podemos agregar, cambiar o retirar
              funciones, siempre buscando no interrumpir la operación de cobranza en curso de
              ninguna escuela.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-ink">8. Contacto</h2>
            <p className="mt-2">
              Para dudas sobre estos términos, usa el{' '}
              <Link href="/contacto" className="text-brand-600 underline underline-offset-2">
                formulario de contacto
              </Link>
              .
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
