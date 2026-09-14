'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FlaskConical, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const OPCIONES = [
  { resultado: 'approved' as const, label: 'Aprobar', variant: 'brand' as const },
  { resultado: 'rejected' as const, label: 'Rechazar', variant: 'outline' as const },
  { resultado: 'pending' as const, label: 'Dejar pendiente', variant: 'outline' as const },
  { resultado: 'refund' as const, label: 'Reembolsar', variant: 'outline' as const },
  { resultado: 'duplicate' as const, label: 'Duplicar evento', variant: 'outline' as const },
];

/**
 * Panel de simulación — SOLO se renderiza cuando el proveedor resuelto para
 * la escuela es 'mock' (ver /p/[token]/page.tsx). Permite probar cada
 * desenlace del checkout sin ninguna credencial real.
 */
export function SimulatePanel({ token }: { token: string }) {
  const router = useRouter();
  const [cargando, setCargando] = useState<string | null>(null);

  async function simular(resultado: (typeof OPCIONES)[number]['resultado']) {
    setCargando(resultado);
    try {
      const res = await fetch('/api/payments/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, resultado }),
      });
      if (res.ok) router.refresh();
    } finally {
      setCargando(null);
    }
  }

  return (
    <div className="rounded-[10px] border border-amber-200 bg-amber-50 p-4">
      <p className="flex items-center gap-1.5 text-[12px] font-medium text-amber-900">
        <FlaskConical className="h-3.5 w-3.5" />
        Modo de prueba — simula el resultado del pago
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-amber-800/80">
        Esta escuela todavía no conecta un proveedor de pagos real. Ningún botón de aquí abajo
        hace un cargo de verdad.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {OPCIONES.map((o) => (
          <Button
            key={o.resultado}
            size="sm"
            variant={o.variant}
            loading={cargando === o.resultado}
            disabled={cargando !== null && cargando !== o.resultado}
            onClick={() => simular(o.resultado)}
          >
            {cargando === o.resultado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
