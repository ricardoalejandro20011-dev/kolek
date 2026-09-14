'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';

export function SchoolActions({ schoolId }: { schoolId: string }) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);

  async function ejecutar(body: Record<string, unknown>, mensaje: string) {
    setCargando(true);
    const res = await fetch('/api/superadmin/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setCargando(false);
    if (!res.ok) return toast.error(json.error ?? 'No se pudo completar la acción');
    toast.success(mensaje);
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon-sm" variant="ghost" disabled={cargando}>
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Acciones</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => ejecutar({ accion: 'activar', school_id: schoolId }, 'Suscripción activada')}>
          Activar suscripción
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => ejecutar({ accion: 'extender_prueba', school_id: schoolId, dias: 14 }, 'Prueba extendida 14 días')}>
          Extender prueba 14 días
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => ejecutar({ accion: 'cambiar_plan', school_id: schoolId, plan: 'crecimiento' }, 'Plan cambiado a Escuela')}>
          Cambiar a plan Escuela
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => ejecutar({ accion: 'cambiar_plan', school_id: schoolId, plan: 'pro' }, 'Plan cambiado a Pro')}>
          Cambiar a plan Pro
        </DropdownMenuItem>
        <DropdownMenuItem destructive onClick={() => ejecutar({ accion: 'suspender', school_id: schoolId }, 'Suscripción suspendida')}>
          Suspender acceso
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
