import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Mail, MessageCircle } from 'lucide-react';
import { SiteNav } from '@/components/marketing/site-nav';
import { SiteFooter } from '@/components/marketing/site-footer';
import { Button } from '@/components/ui/button';
import { brand } from '@/config/brand';

export const metadata: Metadata = { title: 'Contacto' };

export default function ContactoPage() {
  const waHref = `https://wa.me/${brand.contactPhoneE164}?text=${encodeURIComponent(
    `Hola, quiero saber más de ${brand.name}.`,
  )}`;

  return (
    <div className="min-h-screen bg-white">
      <SiteNav />
      <main className="mx-auto w-full max-w-[640px] px-6 py-20 text-center">
        <p className="eyebrow">Contacto</p>
        <h1 className="mt-3 text-display-md text-ink">Hablemos de tu cobranza</h1>
        <p className="mx-auto mt-4 max-w-[46ch] text-[15px] leading-relaxed text-muted-foreground">
          La forma más rápida de hablar con nosotros es pedir una demo, o escribirnos
          directamente por WhatsApp o correo.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" variant="brand">
            <Link href="/demo">
              Solicitar demo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={waHref} target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
          </Button>
        </div>

        <div className="mx-auto mt-10 flex max-w-[420px] flex-col gap-3 rounded-[12px] border border-[#111111]/[0.09] bg-[#111111]/[0.02] p-6 text-left">
          <a
            href={`mailto:${brand.contactEmail}`}
            className="flex items-center gap-3 text-[14px] text-ink hover:text-brand-600"
          >
            <Mail className="h-4 w-4 shrink-0 text-brand-600" />
            {brand.contactEmail}
          </a>
          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 text-[14px] text-ink hover:text-brand-600"
          >
            <MessageCircle className="h-4 w-4 shrink-0 text-brand-600" />
            <span className="tnum">{brand.contactPhoneDisplay}</span>
          </a>
        </div>

        <p className="mt-10 text-[12px] text-muted-foreground">
          {brand.name} es un producto de{' '}
          <a href={brand.parentCompanyUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
            {brand.parentCompany}
          </a>
          .
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
