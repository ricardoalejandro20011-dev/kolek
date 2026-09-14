import type { Metadata } from 'next';
import { requireSchool } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { SettingsView } from '@/components/dashboard/settings-view';
import { mercadoPagoPlataformaConfigurada } from '@/config/env';
import type { Concept, Group, Profile, Student } from '@/lib/types';
import type { Subscription } from '@/lib/subscriptions';

export const metadata: Metadata = { title: 'Configuración' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { school, profile, userId } = await requireSchool();
  const supabase = createClient();

  const [gruposRes, conceptosRes, equipoRes, alumnosRes, ppcRes, subRes] = await Promise.all([
    supabase.from('groups').select('*').eq('school_id', school.id).order('orden').returns<Group[]>(),
    supabase
      .from('concepts')
      .select('*')
      .eq('school_id', school.id)
      .order('created_at')
      .returns<Concept[]>(),
    supabase
      .from('profiles')
      .select('*')
      .eq('school_id', school.id)
      .order('created_at')
      .returns<Profile[]>(),
    supabase
      .from('students')
      .select('id, group_id')
      .eq('school_id', school.id)
      .eq('status', 'activo')
      .returns<Pick<Student, 'id' | 'group_id'>[]>(),
    supabase
      .from('payment_provider_connections_public')
      .select('*')
      .eq('school_id', school.id)
      .eq('provider', 'mercadopago')
      .maybeSingle(),
    supabase.from('subscriptions').select('*').eq('school_id', school.id).maybeSingle<Subscription>(),
  ]);

  const alumnosPorGrupo: Record<string, number> = {};
  for (const a of alumnosRes.data ?? []) {
    const k = a.group_id ?? 'sin-grupo';
    alumnosPorGrupo[k] = (alumnosPorGrupo[k] ?? 0) + 1;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-[#111111]/[0.08] bg-white/90 px-6 py-4 backdrop-blur-md lg:px-8">
        <h1 className="text-[20px] font-semibold tracking-[-0.025em] text-ink">Configuración</h1>
        <p className="text-[13px] text-muted-foreground">
          Perfil, grupos, conceptos, integraciones y equipo de {school.name}
        </p>
      </header>

      <div className="flex-1 px-6 py-6 lg:px-8">
        <div className="mx-auto max-w-[1000px]">
          <SettingsView
            school={school}
            grupos={gruposRes.data ?? []}
            conceptos={conceptosRes.data ?? []}
            equipo={equipoRes.data ?? []}
            miId={userId}
            miRol={profile.role}
            alumnosPorGrupo={alumnosPorGrupo}
            mpConexion={ppcRes.data ?? null}
            mpPlataformaConfigurada={mercadoPagoPlataformaConfigurada()}
            suscripcion={subRes.data ?? null}
          />
        </div>
      </div>
    </div>
  );
}
