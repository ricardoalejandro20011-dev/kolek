'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';

/**
 * Supabase manda al usuario aquí con un link de recuperación; el cliente de
 * navegador (createBrowserClient, detectSessionInUrl activo por default)
 * intercambia ese link por una sesión temporal de "recovery" automáticamente
 * al montar la página — no hay que hacer nada especial para leerlo.
 */
export function ResetForm() {
  const router = useRouter();
  const [listo, setListo] = useState<'cargando' | 'ok' | 'sin_sesion'>('cargando');
  const [password, setPassword] = useState('');
  const [verPass, setVerPass] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setListo(data.session ? 'ok' : 'sin_sesion');
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('La contraseña necesita al menos 8 caracteres.');
      return;
    }

    setGuardando(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    setGuardando(false);

    if (err) {
      setError(err.message);
      return;
    }

    toast.success('Contraseña actualizada');
    router.push('/dashboard');
    router.refresh();
  }

  if (listo === 'cargando') {
    return <p className="text-[13px] text-muted-foreground">Verificando tu link…</p>;
  }

  if (listo === 'sin_sesion') {
    return (
      <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-6">
        <TriangleAlert className="h-5 w-5 text-amber-600" />
        <h2 className="mt-3 text-[15px] font-semibold text-amber-900">
          Este link ya no es válido
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-amber-800/85">
          Los links de recuperación expiran después de un rato o de usarse una vez. Pide uno
          nuevo desde el login.
        </p>
        <a href="/login" className="mt-4 inline-block text-[13px] font-medium text-brand-600 hover:underline">
          Volver al login
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="password">Contraseña nueva</Label>
        <div className="relative">
          <Input
            id="password"
            type={verPass ? 'text' : 'password'}
            autoComplete="new-password"
            required
            placeholder="Mínimo 8 caracteres"
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

      <Button type="submit" variant="brand" className="w-full" size="lg" loading={guardando}>
        Guardar contraseña
      </Button>
    </form>
  );
}
