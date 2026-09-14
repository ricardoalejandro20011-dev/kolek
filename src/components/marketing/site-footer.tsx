import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { brand } from '@/config/brand';

const COLUMNAS = [
  {
    titulo: 'Producto',
    links: [
      { href: '/#beneficios', label: 'Qué hace Kolek' },
      { href: '/#como', label: 'Cómo funciona' },
      { href: '/planes', label: 'Planes y precios' },
    ],
  },
  {
    titulo: 'Tipos de escuela',
    links: [
      { href: '/#tipos', label: 'Estancias infantiles y kínder' },
      { href: '/#tipos', label: 'Primaria y secundaria' },
      { href: '/#tipos', label: 'Prepa y universidad' },
      { href: '/#tipos', label: 'Academias y cursos' },
    ],
  },
  {
    titulo: 'Empezar',
    links: [
      { href: '/demo', label: 'Solicitar demo' },
      { href: '/registro', label: 'Crear cuenta' },
      { href: '/login', label: 'Entrar' },
      { href: '/#faq', label: 'Preguntas frecuentes' },
    ],
  },
  {
    titulo: 'Legal',
    links: [
      { href: '/aviso-privacidad', label: 'Aviso de privacidad' },
      { href: '/terminos', label: 'Términos y condiciones' },
      { href: '/cancelacion', label: 'Cancelación' },
      { href: '/contacto', label: 'Contacto' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-[#111111]/[0.08] bg-white">
      <div className="mx-auto w-full max-w-[1180px] px-6 py-16">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-4">
            <Logo />
            <p className="mt-4 max-w-[26ch] text-[13px] leading-relaxed text-muted-foreground">
              {brand.tagline}. Cobra antes, concilia automáticamente y persigue menos —
              de la estancia infantil de 40 alumnos a la universidad de 800.
            </p>
            <p className="mt-6 text-[12px] text-muted-foreground">
              No somos un ERP escolar. No reemplazamos tu sistema académico.
            </p>
            <div className="mt-4 space-y-1 text-[12px] text-muted-foreground">
              <a href={`mailto:${brand.contactEmail}`} className="block hover:text-ink">
                {brand.contactEmail}
              </a>
              <a href="/contacto" className="block hover:text-ink">
                {brand.contactPhoneDisplay}
              </a>
            </div>
          </div>

          <div className="grid gap-10 sm:grid-cols-2 md:col-span-8 lg:grid-cols-4">
            {COLUMNAS.map((col) => (
              <div key={col.titulo}>
                <p className="eyebrow">{col.titulo}</p>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="text-[13px] text-muted-foreground transition-colors hover:text-ink"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-[#111111]/[0.08] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-muted-foreground">
            © {new Date().getFullYear()} {brand.name}. Hecho en México.
          </p>
          <p className="text-[12px] text-muted-foreground">
            {brand.name} ·{' '}
            <a
              href={brand.parentCompanyUrl}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-ink"
            >
              {brand.footerLine}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
