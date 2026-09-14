import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Guard del panel /superadmin. NUNCA se basa en una variable leíble desde
 * el navegador: exige sesión real + profiles.is_superadmin = true en la
 * base de datos (columna que solo se activa a mano, ver docs/security.md).
 * SUPERADMIN_EMAILS en .env es una capa adicional, no la única.
 */
export async function requireSuperadmin(): Promise<{ userId: string; email: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

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
  const autorizado = Boolean(perfil?.is_superadmin) && (emailsPermitidos.length === 0 || emailsPermitidos.includes(email));

  if (!autorizado) redirect('/dashboard');

  return { userId: user.id, email };
}
