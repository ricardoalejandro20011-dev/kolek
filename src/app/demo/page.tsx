import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { AuthShell } from '@/components/auth/auth-shell';
import { DemoForm } from './demo-form';

export const metadata: Metadata = { title: 'Solicitar demo' };

function PanelDemo() {
  return (
    <>
      <p className="eyebrow">Lo que incluye tu demo</p>
      <h2 className="mt-4 max-w-[20ch] text-display-sm text-ink">
        Demo adaptada a tu escuela, no una presentación genérica.
      </h2>
      <ul className="mt-10 space-y-3">
        {['Recorrido de 15 minutos', 'Sin tarjeta', 'Sin compromiso'].map((t) => (
          <li key={t} className="flex items-start gap-2.5 text-[13px] text-ink/80">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" strokeWidth={2.6} />
            {t}
          </li>
        ))}
      </ul>
    </>
  );
}

export default function DemoPage() {
  return (
    <AuthShell
      titulo="Solicita una demo"
      subtitulo="Te mostramos Kolek con datos parecidos a los de tu escuela."
      panel={<PanelDemo />}
      pie={
        <>
          ¿Prefieres explorarlo tú mismo?{' '}
          <Link href="/registro" className="font-medium text-brand-600 hover:underline">
            Crea tu cuenta
          </Link>
        </>
      }
    >
      <DemoForm />
    </AuthShell>
  );
}
