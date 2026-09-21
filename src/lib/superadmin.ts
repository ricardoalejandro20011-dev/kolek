import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export class SuperadminAuthError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function resolverSuperadmin(): Promise<{ userId: string; email: string } | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: perfil } = await supabase
    .from('profiles')
    .select('is_superadmin, email')
    .eq('id', user.id)
    .maybeSingle();

  const emailsPermitidos = (process.env.SUPERADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const email = (perfil?.email ?? user.email ?? '').toLowerCase();
  const autorizado =
    Boolean(perfil?.is_superadmin) && (emailsPermitidos.length === 0 || emailsPermitidos.includes(email));

  return autorizado ? { userId: user.id, email } : null;
}

/**
 * Guard para PÁGINAS (/superadmin). Usa redirect() de next/navigation, que
 * está pensado para Server Components — nunca para Route Handlers.
 */
export async function requireSuperadmin(): Promise<{ userId: string; email: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const resultado = await resolverSuperadmin();
  if (!resultado) redirect('/dashboard');
  return resultado;
}

/**
 * Guard para ROUTE HANDLERS (/api/superadmin/**). Nunca redirige: un
 * fetch() del cliente que recibe un 307 en vez de JSON se rompe en
 * silencio (sigue el redirect y trata el HTML de /login como si fuera la
 * respuesta). Aquí se lanza un error tipado que el route handler convierte
 * en un 401/403 JSON explícito.
 */
export async function requireSuperadminApi(): Promise<{ userId: string; email: string }> {
  const resultado = await resolverSuperadmin();
  if (!resultado) {
    throw new SuperadminAuthError('No autorizado — se requiere acceso de superadmin', 403);
  }
  return resultado;
}
