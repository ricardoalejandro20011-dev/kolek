'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { APP_URL } from '@/lib/utils';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPass, setVerPass] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modoRecuperar, setModoRecuperar] = useState(false);
  const [correoEnviado, setCorreoEnviado] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);

    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (err) {
      const msg =
        err.message === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos.'
          : err.message === 'Email not confirmed'
            ? 'Confirma tu correo antes de entrar. Te mandamos un link al registrarte.'
            : err.message;
      setError(msg);
      setCargando(false);
      return;
    }

    toast.success('Bienvenida de vuelta');
    router.push(next);
    router.refresh();
  }

  async function onRecuperar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);

    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${APP_URL}/restablecer-contrasena`,
    });

    setCargando(false);
    // Siempre mostramos éxito, exista o no esa cuenta — así no se puede usar
    // este formulario para adivinar qué correos están registrados.
    if (err) console.error('[reset-password]', err.message);
    setCorreoEnviado(true);
  }

  if (modoRecuperar) {
    if (correoEnviado) {
      return (
        <div className="rounded-[12px] border border-[#111111]/[0.09] bg-white p-6 shadow-subtle">
          <MailCheck className="h-6 w-6 text-brand-500" strokeWidth={1.7} />
          <h2 className="mt-4 text-[15px] font-semibold tracking-[-0.01em]">Revisa tu correo</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Si <strong className="text-ink">{email}</strong> tiene una cuenta, te mandamos un link
            para poner una contraseña nueva. Puede tardar unos minutos; revisa spam también.
          </p>
          <button
            type="button"
            onClick={() => {
              setModoRecuperar(false);
              setCorreoEnviado(false);
            }}
            className="mt-4 text-[13px] font-medium text-brand-600 hover:underline"
          >
            Volver a entrar
          </button>
        </div>
      );
    }

    return (
      <form onSubmit={onRecuperar} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email-recuperar">Correo</Label>
          <Input
            id="email-recuperar"
            type="email"
            autoComplete="email"
            required
            placeholder="direccion@tuescuela.mx"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <Button type="submit" variant="brand" className="w-full" size="lg" loading={cargando}>
          Enviar link de recuperación
        </Button>

        <button
          type="button"
          onClick={() => setModoRecuperar(false)}
          className="w-full text-center text-[13px] text-muted-foreground hover:text-ink"
        >
          Volver a entrar
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Correo</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          placeholder="direccion@tuescuela.mx"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Contraseña</Label>
          <button
            type="button"
            onClick={() => setModoRecuperar(true)}
            className="text-[12px] font-medium text-brand-600 hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={verPass ? 'text' : 'password'}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setVerPass((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-[6px] p-1.5 text-muted-foreground hover:bg-[#111111]/[0.05]"
            aria-label={verPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {verPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="brand" className="w-full" size="lg" loading={cargando}>
        Entrar
      </Button>
    </form>
  );
}
