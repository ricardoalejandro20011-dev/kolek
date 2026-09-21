-- ══════════════════════════════════════════════════════════════════════════
-- KOLEK — 003: Endurecimiento de seguridad tras prueba real
--
-- Hallazgo crítico confirmado con una prueba real (no teórico): la policy
-- de RLS "profiles: editar el mio" solo valida QUÉ FILA se edita
-- (id = auth.uid()), no QUÉ COLUMNAS. RLS es row-level, no column-level.
-- Eso significa que cualquier usuario autenticado podía, con una sola
-- llamada REST directa a Supabase (sin pasar por la app, sin necesitar
-- ningún exploit sofisticado), hacer:
--
--   supabase.from('profiles').update({ is_superadmin: true }).eq('id', miId)
--
-- y convertirse en superadmin de toda la plataforma. Se probó en vivo
-- contra la cuenta demo y funcionó — por eso se corrige aquí antes que
-- nada más. La reparación es a nivel de GRANT de Postgres (column-level),
-- que sí existe y RLS no reemplaza.
-- ══════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────
-- 1. profiles — nadie autenticado puede tocar is_superadmin, role, school_id
--    o email por su cuenta. Ningún código del cliente lo necesita hoy (se
--    verificó: cero llamadas a profiles.update en toda la app) — el único
--    campo legítimo para que alguien edite su propia fila es su nombre.
-- ──────────────────────────────────────────────────────────────────────────
revoke update on public.profiles from authenticated;
grant update (nombre) on public.profiles to authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. schools.plan — el onboarding SÍ necesita poder ponerlo (elige el plan
--    inicial antes de terminar de configurarse), pero después de terminar
--    el onboarding nadie debe poder subir de plan solo, sin pasar por
--    /api/subscription/change-plan (que sí audita el cambio). Un trigger
--    hace lo que un GRANT de columna no puede: permitir condicionalmente.
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.proteger_plan_post_onboarding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- El propio backend (service_role, usado por /api/subscription/change-plan
  -- y /api/superadmin/actions) SIEMPRE puede cambiar el plan.
  if auth.role() = 'service_role' then
    return new;
  end if;

  -- Antes de terminar el onboarding, el wizard todavía puede elegir plan.
  if old.onboarding_completo = false then
    return new;
  end if;

  -- Ya con la escuela configurada: cualquier intento de cambiar el plan
  -- desde el cliente se ignora en silencio (se conserva el valor anterior)
  -- en vez de tronar — así no rompe un guardado de otros campos del mismo
  -- formulario que sí son legítimos (nombre, whatsapp, etc.).
  if new.plan is distinct from old.plan then
    new.plan := old.plan;
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_plan_post_onboarding_trigger on public.schools;
create trigger proteger_plan_post_onboarding_trigger
  before update on public.schools
  for each row execute function public.proteger_plan_post_onboarding();

-- ══════════════════════════════════════════════════════════════════════════
-- FIN 003.
-- ══════════════════════════════════════════════════════════════════════════
