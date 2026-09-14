import type { Metadata } from 'next';
import { SiteNav } from '@/components/marketing/site-nav';
import { SiteFooter } from '@/components/marketing/site-footer';
import { brand } from '@/config/brand';

export const metadata: Metadata = { title: 'Aviso de privacidad' };

export default function AvisoPrivacidadPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteNav />
      <main className="mx-auto w-full max-w-[760px] px-6 py-16">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-3 text-display-md text-ink">Aviso de privacidad</h1>
        <p className="mt-3 text-[13px] text-muted-foreground">
          Última actualización: {new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long' })}
        </p>

        <div className="prose-kolek mt-10 space-y-8 text-[14px] leading-relaxed text-ink/85">
          <section>
            <h2 className="text-[16px] font-semibold text-ink">1. Quién trata tus datos</h2>
            <p className="mt-2">
              {brand.name} es un producto de {brand.parentCompany}. Cuando una escuela usa{' '}
              {brand.name} para gestionar su cobranza, {brand.name} actúa como{' '}
              <strong>encargado del tratamiento</strong>: procesamos los datos de alumnos, tutores
              y pagos siguiendo las instrucciones de la escuela (el responsable del tratamiento
              frente a las familias), no por cuenta propia.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-ink">2. Qué datos se procesan</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>Datos de la escuela: nombre, nivel educativo, WhatsApp de contacto.</li>
              <li>Datos de usuarios del equipo escolar: nombre, correo, rol.</li>
              <li>Datos de alumnos que la escuela captura: nombre, grupo, matrícula, estatus.</li>
              <li>Datos de tutores: nombre, WhatsApp, correo — para enviar recordatorios de pago.</li>
              <li>Datos de cobranza: montos, conceptos, fechas, estado de cada pago, referencias del proveedor de pagos.</li>
            </ul>
            <p className="mt-2">
              {brand.name} no solicita ni almacena datos de tarjeta: el formulario de pago con
              tarjeta lo procesa directamente el proveedor de pagos conectado por la escuela.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-ink">3. Para qué se usan</h2>
            <p className="mt-2">
              Exclusivamente para operar la cobranza: generar cargos, enviar recordatorios,
              procesar y conciliar pagos, y generar reportes para la propia escuela.{' '}
              <strong>Los datos de alumnos y tutores nunca se usan para entrenar modelos de
              inteligencia artificial</strong>, ni se venden ni se comparten con terceros ajenos a
              la operación del pago (el proveedor de pagos y, cuando aplique, el proveedor de
              mensajería).
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-ink">4. Con quién se comparten</h2>
            <p className="mt-2">
              Con el proveedor de pagos que la propia escuela conecta (hoy, Mercado Pago) para
              procesar cada cobro, y con el proveedor de mensajería (WhatsApp Cloud API de Meta)
              cuando la escuela lo activa. {brand.name} no comparte datos con nadie más.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-ink">5. Aislamiento entre escuelas</h2>
            <p className="mt-2">
              Los datos de cada escuela están separados de los de cualquier otra institución que
              use {brand.name}. Ninguna escuela puede ver información de otra.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-ink">6. Tus derechos (ARCO)</h2>
            <p className="mt-2">
              Puedes solicitar acceso, rectificación, cancelación u oposición sobre tus datos.
              Como {brand.name} actúa como encargado, la vía más rápida es pedirlo directamente a
              tu escuela; también puedes escribirnos a través del{' '}
              <a href="/demo" className="text-brand-600 underline underline-offset-2">
                formulario de contacto
              </a>{' '}
              de la plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-ink">7. Exportación y eliminación</h2>
            <p className="mt-2">
              Una escuela puede exportar su información (alumnos, pagos) en cualquier momento
              desde su cuenta. Si una escuela cancela su cuenta, puede solicitar la eliminación de
              sus datos sujeto al periodo de retención necesario por obligaciones contables.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
