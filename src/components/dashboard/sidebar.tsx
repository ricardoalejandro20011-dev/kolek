'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ChevronsUpDown,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { brand } from '@/config/brand';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { createClient } from '@/lib/supabase/client';
import { PLAN_POR_ID } from '@/lib/plans';
import { NIVEL_LABEL, type School } from '@/lib/types';
import { cn, initials } from '@/lib/utils';

const NAV = [
  { href: '/dashboard', label: 'Cobranza', Icon: LayoutDashboard, exact: true },
  { href: '/dashboard/alumnos', label: 'Alumnos', Icon: Users },
  { href: '/dashboard/whatsapp', label: 'WhatsApp', Icon: MessageCircle },
  { href: '/dashboard/settings', label: 'Configuración', Icon: Settings },
];

export function Sidebar({
  school,
  email,
  nombreUsuario,
  alumnosActivos,
  esSuperadmin,
}: {
  school: School;
  email: string;
  nombreUsuario: string | null;
  alumnosActivos: number;
  esSuperadmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  const plan = PLAN_POR_ID[school.plan];
  const uso = plan ? Math.min(100, Math.round((alumnosActivos / plan.limite) * 100)) : 0;

  async function salir() {
    setSaliendo(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="flex h-full w-full flex-col border-r border-[#111111]/[0.08] bg-[#111111]/[0.012]">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Link href="/dashboard" aria-label={brand.name}>
          <Logo />
        </Link>
      </div>

      {/* Escuela */}
      <div className="px-3">
        <div className="rounded-[10px] border border-[#111111]/[0.08] bg-white p-3 shadow-subtle">
          <p className="truncate text-[13px] font-semibold tracking-[-0.01em] text-ink">
            {school.name}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {NIVEL_LABEL[school.nivel]} · {alumnosActivos} activos
          </p>

          {plan ? (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  Plan {plan.nombre}
                </span>
                <span className="tnum text-muted-foreground">
                  {alumnosActivos}/{plan.limite}
                </span>
              </div>
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[#111111]/[0.07]">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    uso >= 100 ? 'bg-red-500' : uso >= 85 ? 'bg-amber-500' : 'bg-brand-500',
                  )}
                  style={{ width: `${Math.max(uso, 3)}%` }}
                />
              </div>
              {uso >= 85 && (
                <Link
                  href="/planes"
                  className="mt-2 inline-block text-[11px] font-medium text-brand-600 hover:underline"
                >
                  {uso >= 100 ? 'Te pasaste del plan · Subir' : 'Casi llegas al límite · Subir'}
                </Link>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Navegación */}
      <nav className="mt-5 flex-1 px-3">
        <ul className="space-y-0.5">
          {NAV.map(({ href, label, Icon, exact }) => {
            const activo = exact ? pathname === href : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[13px] transition-colors',
                    activo
                      ? 'bg-white font-medium text-ink shadow-subtle'
                      : 'text-muted-foreground hover:bg-[#111111]/[0.04] hover:text-ink',
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.7} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Usuario */}
      <div className="border-t border-[#111111]/[0.08] p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-[9px] px-2 py-2 text-left transition-colors hover:bg-[#111111]/[0.04]">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-[10px] font-semibold text-white">
              {initials(nombreUsuario || email || 'KO')}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 truncate text-[12px] font-medium text-ink">
                <span className="truncate">{nombreUsuario || 'Mi cuenta'}</span>
                {esSuperadmin && (
                  <Badge variant="brand" className="shrink-0 px-1.5 py-0 text-[9px]">
                    Superadmin
                  </Badge>
                )}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">{email}</span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>{school.name}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings">
                <Settings />
                Configuración
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/planes">Planes y límites</Link>
            </DropdownMenuItem>
            {esSuperadmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/superadmin">
                    <ShieldCheck />
                    Panel interno (superadmin)
                  </Link>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onClick={salir} disabled={saliendo}>
              <LogOut />
              {saliendo ? 'Saliendo…' : 'Cerrar sesión'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
