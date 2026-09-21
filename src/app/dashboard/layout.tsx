import { redirect } from 'next/navigation';
import { requireSchool } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/dashboard/sidebar';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { school, email, profile } = await requireSchool();

  // Si entró directo al dashboard sin terminar de configurar, lo regresamos.
  if (!school.onboarding_completo) redirect('/onboarding');

  const supabase = createClient();
  const { count } = await supabase
    .from('students')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', school.id)
    .eq('status', 'activo');

  return (
    <div className="flex min-h-screen bg-white">
      <div className="sticky top-0 hidden h-screen w-[248px] shrink-0 lg:block">
        <Sidebar
          school={school}
          email={email}
          nombreUsuario={profile.nombre}
          alumnosActivos={count ?? 0}
          esSuperadmin={profile.is_superadmin}
        />
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
