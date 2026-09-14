'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { brand } from '@/config/brand';
import { trackClient } from '@/lib/analytics-client';

const RANGOS_ALUMNOS = ['Menos de 80', '80–300', '300–700', 'Más de 700'];

export function DemoForm() {
  const [nombre, setNombre] = useState('');
  const [escuela, setEscuela] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [alumnos, setAlumnos] = useState('');
  const [aceptaContacto, setAceptaContacto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const yaAvisoInicio = useRef(false);

  useEffect(() => {
    if (yaAvisoInicio.current) return;
    yaAvisoInicio.current = true;
    trackClient('demo_form_start');
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!alumnos) {
      setError('Elige un rango aproximado de alumnos.');
      return;
    }
    if (!aceptaContacto) {
      setError('Necesitamos tu autorización para contactarte.');
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch('/api/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          escuela: escuela.trim(),
          whatsapp: whatsapp.trim(),
          alumnos_aprox: alumnos,
          acepta_contacto: true,
          sitio_web: '',
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'No se pudo enviar. Intenta de nuevo.');
        return;
      }
      setEnviado(true);
    } catch {
      setError('Falló la conexión. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    const waHref = `https://wa.me/${brand.contactPhoneE164}?text=${encodeURIComponent(
      `Hola, soy ${nombre} de ${escuela}. Acabo de pedir una demo de ${brand.name} (${alumnos} alumnos aprox.) y quiero agendarla.`,
    )}`;

    return (
      <div className="rounded-[12px] border border-emerald-200 bg-emerald-50 p-6">
        <CheckCircle2 className="h-6 w-6 text-emerald-600" strokeWidth={1.7} />
        <h2 className="mt-4 text-[15px] font-semibold tracking-[-0.01em] text-emerald-900">
          Listo, ya llegó tu solicitud
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-emerald-800/85">
          Te contactamos por WhatsApp para agendar tu demo de 15 minutos, adaptada a tu escuela.
        </p>
        <Button asChild variant="brand" className="mt-4 w-full">
          <a href={waHref} target="_blank" rel="noreferrer">
            <MessageCircle className="h-4 w-4" />
            Escríbenos ahora por WhatsApp
          </a>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="d-nombre">Tu nombre</Label>
        <Input
          id="d-nombre"
          required
          autoComplete="name"
          placeholder="Directora, administradora o dueño"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="d-escuela">Escuela</Label>
        <Input
          id="d-escuela"
          required
          placeholder="Nombre de tu escuela"
          value={escuela}
          onChange={(e) => setEscuela(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="d-whatsapp">WhatsApp</Label>
        <Input
          id="d-whatsapp"
          required
          inputMode="tel"
          autoComplete="tel"
          placeholder="55 1234 5678"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="d-alumnos">Número aproximado de alumnos</Label>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby="d-alumnos">
          {RANGOS_ALUMNOS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={alumnos === r}
              onClick={() => setAlumnos(r)}
              className={`min-h-[44px] rounded-[10px] border px-3 py-2 text-[13px] transition-colors ${
                alumnos === r
                  ? 'border-brand-400 bg-brand-50 text-brand-700'
                  : 'border-[#111111]/12 text-muted-foreground hover:border-[#111111]/25'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-start gap-2.5 text-[12px] leading-relaxed text-muted-foreground">
        <input
          type="checkbox"
          checked={aceptaContacto}
          onChange={(e) => setAceptaContacto(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#111111]/25"
        />
        Autorizo a Kolek a contactarme por WhatsApp para agendar la demo. Ver el{' '}
        <Link href="/aviso-privacidad" className="underline underline-offset-2 hover:text-ink">
          aviso de privacidad
        </Link>
        .
      </label>

      {/* Honeypot: oculto para personas, visible para bots que llenan todo. */}
      <input
        type="text"
        name="sitio_web"
        tabIndex={-1}
        autoComplete="off"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
        aria-hidden="true"
      />

      {error ? (
        <p className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="brand" className="w-full" size="lg" loading={enviando}>
        Solicitar demo
      </Button>

      <p className="text-[12px] leading-relaxed text-muted-foreground">
        15 minutos · Sin compromiso · Sin tarjeta
      </p>
    </form>
  );
}
