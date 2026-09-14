'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { brand } from '@/config/brand';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/#beneficios', label: 'Producto' },
  { href: '/#como', label: 'Cómo funciona' },
  { href: '/planes', label: 'Planes' },
  { href: '/#faq', label: 'Preguntas' },
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full border-b transition-colors duration-200',
        scrolled
          ? 'border-[#111111]/[0.08] bg-white/85 backdrop-blur-md'
          : 'border-transparent bg-white',
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center gap-8 px-6">
        <Link href="/" className="shrink-0" aria-label={`${brand.name} — inicio`}>
          <Logo />
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[13px] text-muted-foreground transition-colors hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Entrar</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/registro">Crear cuenta</Link>
          </Button>
          <Button asChild variant="brand" size="sm">
            <Link href="/demo">Solicitar demo</Link>
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="ml-auto rounded-[8px] p-2 text-ink md:hidden"
          aria-label="Abrir menú"
          aria-expanded={abierto}
        >
          {abierto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {abierto && (
        <div className="border-t border-[#111111]/[0.08] bg-white px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setAbierto(false)}
                className="rounded-[8px] px-2 py-2 text-sm text-ink hover:bg-[#111111]/[0.04]"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild variant="brand" size="sm" className="flex-1">
              <Link href="/demo">Solicitar demo</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="flex-1">
              <Link href="/registro">Crear cuenta</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="flex-1">
              <Link href="/login">Entrar</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
