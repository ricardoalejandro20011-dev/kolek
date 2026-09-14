import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SiteNav } from '@/components/marketing/site-nav';
import { SiteFooter } from '@/components/marketing/site-footer';
import { Button } from '@/components/ui/button';
import { brand } from '@/config/brand';

export const metadata: Metadata = { title: 'Contacto' };

export default function ContactoPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteNav />
      <main className="mx-auto w-full max-w-[640px] px-6 py-20 text-center">
        <p className="eyebrow">Contacto</p>
        <h1 className="mt-3 text-display-md text-ink">Hablemos de tu cobranza</h1>
        <p className="mx-auto mt-4 max-w-[46ch] text-[15px] leading-relaxed text-muted-foreground">
          La forma más rápida de hablar con nosotros es pedir una demo: dejas tu WhatsApp y te
          contactamos directamente.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" variant="brand">
            <Link href="/demo">
              Solicitar demo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={brand.parentCompanyUrl} target="_blank" rel="noreferrer">
              {brand.parentCompany}
            </a>
          </Button>
        </div>

        <p className="mt-10 text-[12px] text-muted-foreground">
          {brand.name} es un producto de {brand.parentCompany}.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
