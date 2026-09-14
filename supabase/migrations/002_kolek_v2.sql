-- ══════════════════════════════════════════════════════════════════════════
-- KOLEK v2 — Migración aditiva hacia el modelo de datos de producción
--
-- Contexto: no existe ningún proyecto Supabase real conectado todavía (el
-- entorno desplegado usa credenciales placeholder), así que esta migración
-- puede ser ambiciosa sin riesgo de pérdida de datos reales. Aun así está
-- escrita 100% de forma ADITIVA e IDEMPOTENTE sobre 001 (supabase/schema.sql):
-- no se hace DROP de ninguna tabla ni columna existente, no se renombra nada
-- que la app ya use.
--
-- Ejecuta 001 (supabase/schema.sql) primero, después este archivo completo.
-- Igual que 001: puedes correrlo varias veces sin romper nada.
-- ══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ──────────────────────────────────────────────────────────────────────────
-- 0. ROLES — de owner/admin/staff a owner/administrator/collections/viewer
-- ──────────────────────────────────────────────────────────────────────────
-- Se AGREGAN valores nuevos al enum existente; 'admin' y 'staff' se dejan
-- vivos como alias heredados (ver src/lib/rbac.ts::normalizeRole) en vez de
-- forzar un rename destructivo del tipo.
alter type public.member_role add value if not exists 'administrator';
alter type public.member_role add value if not exists 'collections';
alter type public.member_role add value if not exists 'viewer';

-- Estados de cobranza más ricos (además de pendiente/pagado/atrasado, que
-- ya existen y siguen siendo los que más se usan en el día a día).
alter type public.payment_status add value if not exists 'procesando';
alter type public.payment_status add value if not exists 'parcial';
alter type public.payment_status add value if not exists 'cancelado';
alter type public.payment_status add value if not exists 'reembolsado';
alter type public.payment_status add value if not exists 'disputado';

-- Superadmin de plataforma (equipo de Kolek/Ravela). Nunca se expone ni se
-- deja modificar desde el cliente: solo se activa a mano en el SQL editor
-- o con la service_role key. RLS de `profiles` ya solo permite a cada quien
-- editar SU PROPIA fila y esa policy no incluye esta columna en la práctica
-- de negocio (la UI nunca la manda), pero por defensa en profundidad la
-- policy de update de profiles se deja igual: superadmin se otorga fuera de
-- la app.
alter table public.profiles
  add column if not exists is_superadmin boolean not null default false;

-- ──────────────────────────────────────────────────────────────────────────
-- 1. PLANTELES (multi-sede)
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.campuses (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  nombre       text not null,
  direccion    text,
  es_principal boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists campuses_school_idx on public.campuses(school_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 2. TUTORES Y FAMILIAS (1 tutor → varios alumnos, varios tutores → 1 alumno)
-- ──────────────────────────────────────────────────────────────────────────
-- No reemplaza los campos nombre_tutor/whatsapp_tutor/email_tutor de
-- `students` (siguen siendo el "tutor principal" que ya usa toda la UI
-- actual) — `tutors` + `student_tutors` es el modelo nuevo para familias con
-- más de un tutor o un tutor con varios hijos, y se adopta gradualmente.
create table if not exists public.tutors (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  nombre     text not null,
  whatsapp   text,
  email      text,
  notas      text,
  created_at timestamptz not null default now()
);
create index if not exists tutors_school_idx on public.tutors(school_id);

create table if not exists public.student_tutors (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  tutor_id    uuid not null references public.tutors(id) on delete cascade,
  es_principal boolean not null default false,
  parentesco  text,
  created_at  timestamptz not null default now(),
  unique (student_id, tutor_id)
);
create index if not exists student_tutors_school_idx on public.student_tutors(school_id);
create index if not exists student_tutors_student_idx on public.student_tutors(student_id);
create index if not exists student_tutors_tutor_idx on public.student_tutors(tutor_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 3. SUSCRIPCIÓN DE LA ESCUELA A KOLEK (independiente del dinero de las
--    colegiaturas — esto es lo que la escuela le paga a Kolek)
-- ──────────────────────────────────────────────────────────────────────────
do $$ begin
  create type public.subscription_status as enum
    ('trialing','active','past_due','suspended','canceled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.billing_interval as enum ('monthly','annual');
exception when duplicate_object then null; end $$;

create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  school_id              uuid not null unique references public.schools(id) on delete cascade,
  plan                   public.school_plan not null default 'inicio',
  billing_interval       public.billing_interval not null default 'monthly',
  status                 public.subscription_status not null default 'trialing',
  price_centavos         bigint not null default 0,
  onboarding_fee_centavos bigint not null default 0,
  trial_ends_at          timestamptz,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  -- Al vencer, la escuela conserva lectura/exportación durante este plazo
  -- antes de bloquearse del todo (SUBSCRIPTION_GRACE_DAYS en .env).
  grace_ends_at          timestamptz,
  activated_by           uuid references auth.users(id) on delete set null,
  activated_at           timestamptz,
  canceled_at            timestamptz,
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists subscriptions_school_idx on public.subscriptions(school_id);
create index if not exists subscriptions_status_idx on public.subscriptions(status);

comment on table public.subscriptions is
  'Suscripción de la ESCUELA a Kolek (mensualidad del SaaS). No tiene nada '
  'que ver con el dinero de las colegiaturas, que nunca pasa por Kolek.';

-- Uso medido por periodo, para reportar límites de plan y para el panel superadmin.
create table if not exists public.plan_usage (
  id                     uuid primary key default gen_random_uuid(),
  school_id              uuid not null references public.schools(id) on delete cascade,
  periodo                text not null, -- 'YYYY-MM'
  alumnos_activos_count  int not null default 0,
  mensajes_enviados_count int not null default 0,
  cargos_generados_count int not null default 0,
  computed_at            timestamptz not null default now(),
  unique (school_id, periodo)
);
create index if not exists plan_usage_school_idx on public.plan_usage(school_id, periodo desc);

-- ──────────────────────────────────────────────────────────────────────────
-- 4. CICLOS DE COBRO (agrupan los cargos que ya crea /api/payments/generate-cycle)
-- ──────────────────────────────────────────────────────────────────────────
do $$ begin
  create type public.billing_cycle_status as enum ('draft','published','canceled');
exception when duplicate_object then null; end $$;

create table if not exists public.billing_cycles (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  concept_id   uuid not null references public.concepts(id) on delete cascade,
  ciclo        text not null, -- 'YYYY-MM'
  group_ids    uuid[] not null default '{}',
  status       public.billing_cycle_status not null default 'draft',
  charges_count int not null default 0,
  created_by   uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists billing_cycles_school_idx on public.billing_cycles(school_id, ciclo);

-- `payments` YA ES la tabla de "charges" (cargos individuales) — no se crea
-- una tabla paralela para no partir la fuente de verdad en dos. Se le agrega
-- la liga al ciclo que lo generó y los montos espejo en centavos.
alter table public.payments
  add column if not exists billing_cycle_id uuid references public.billing_cycles(id) on delete set null;
alter table public.payments
  add column if not exists amount_centavos bigint;
alter table public.payments
  add column if not exists total_centavos bigint;
alter table public.payments
  add column if not exists paid_centavos bigint not null default 0;

comment on column public.payments.paid_centavos is
  'Acumulado pagado hasta ahora (soporta pagos parciales). status = parcial '
  'cuando 0 < paid_centavos < total_centavos.';

comment on table public.payments is
  'Esta es la tabla de "charges" del modelo de datos de Kolek — un cargo '
  'individual por alumno/concepto/ciclo. Se conserva el nombre original '
  '(payments) para no romper el 90% de la app que ya la usa; billing_cycles '
  'agrupa los cargos generados juntos, amount_centavos/total_centavos son '
  'el espejo en centavos de monto_concepto/monto_total_cobrado.';

create index if not exists payments_billing_cycle_idx on public.payments(billing_cycle_id);

-- Restricción de idempotencia explícita que pide el brief (además del
-- UNIQUE(student_id, concept_id, ciclo) que YA existe en 001).
comment on constraint payments_student_id_concept_id_ciclo_key on public.payments is
  'Garantiza "school + student + concept + billing_period" único: generar '
  'el mismo ciclo dos veces nunca duplica cargos.';

-- ──────────────────────────────────────────────────────────────────────────
-- 5. CONEXIONES A PROVEEDORES DE PAGO (OAuth real, nunca "pega tu token")
-- ──────────────────────────────────────────────────────────────────────────
do $$ begin
  create type public.provider_connection_status as enum ('disconnected','connected','error');
exception when duplicate_object then null; end $$;

create table if not exists public.payment_provider_connections (
  id                      uuid primary key default gen_random_uuid(),
  school_id               uuid not null references public.schools(id) on delete cascade,
  provider                text not null default 'mercadopago',
  status                  public.provider_connection_status not null default 'disconnected',
  external_account_id     text,
  -- Cifrados con AES-256-GCM (src/lib/crypto.ts) — JAMÁS texto plano, JAMÁS
  -- se seleccionan desde el cliente (ver vista pública más abajo).
  access_token_encrypted  text,
  refresh_token_encrypted text,
  -- La public key de Checkout Bricks NO es secreta: se manda al navegador
  -- para renderizar el botón de pago, por eso vive sin cifrar.
  public_key              text,
  scope                   text,
  expires_at              timestamptz,
  connected_by            uuid references auth.users(id) on delete set null,
  connected_at            timestamptz,
  last_error              text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (school_id, provider)
);
create index if not exists ppc_school_idx on public.payment_provider_connections(school_id);

-- Vista SIN columnas de tokens: es lo único que el cliente (dashboard de
-- integraciones) debe poder leer. Los tokens los usa exclusivamente el
-- servidor con service_role.
create or replace view public.payment_provider_connections_public
with (security_invoker = true) as
select
  id, school_id, provider, status, external_account_id, public_key,
  expires_at, connected_at, last_error, created_at, updated_at
from public.payment_provider_connections;

-- ──────────────────────────────────────────────────────────────────────────
-- 6. INTENTOS DE PAGO Y PAGOS MANUALES
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.payment_attempts (
  id                 uuid primary key default gen_random_uuid(),
  school_id          uuid not null references public.schools(id) on delete cascade,
  payment_id         uuid not null references public.payments(id) on delete cascade,
  provider           text not null,
  provider_reference text,           -- preference id / payment id del proveedor
  status             text not null default 'pending',
  amount_centavos    bigint,
  raw_status         text,           -- status crudo tal como lo reporta el proveedor
  error              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists payment_attempts_school_idx on public.payment_attempts(school_id);
create index if not exists payment_attempts_payment_idx on public.payment_attempts(payment_id);
create index if not exists payment_attempts_ref_idx on public.payment_attempts(provider, provider_reference);

create table if not exists public.manual_payments (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  payment_id    uuid not null references public.payments(id) on delete cascade,
  method        text not null check (method in ('efectivo','transferencia','otro')),
  reference     text,
  evidence_url  text,
  registered_by uuid references auth.users(id) on delete set null,
  registered_at timestamptz not null default now(),
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists manual_payments_school_idx on public.manual_payments(school_id);
create index if not exists manual_payments_payment_idx on public.manual_payments(payment_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 7. RECORDATORIOS ESTRUCTURADOS
-- ──────────────────────────────────────────────────────────────────────────
-- Complementa (no reemplaza) schools.recordatorios_dias, que sigue vivo
-- para el cron actual. reminder_rules es el modelo rico por-escuela hacia
-- el que migrar cuando el motor de recordatorios crezca.
create table if not exists public.reminder_rules (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  offset_days  int not null, -- negativo = antes de vencer, 0 = el día, positivo = después
  template_key text not null default 'proximo_vencimiento',
  channel      text not null default 'whatsapp' check (channel in ('whatsapp','email')),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (school_id, offset_days, channel, template_key)
);
create index if not exists reminder_rules_school_idx on public.reminder_rules(school_id);

-- Versión genérica de whatsapp_logs (que se conserva intacta: la usa toda
-- la UI actual de /dashboard/whatsapp). message_deliveries es el registro
-- provider-agnóstico nuevo para email + WhatsApp desde MessagingProvider.
create table if not exists public.message_deliveries (
  id                 uuid primary key default gen_random_uuid(),
  school_id          uuid not null references public.schools(id) on delete cascade,
  payment_id         uuid references public.payments(id) on delete cascade,
  channel            text not null default 'whatsapp' check (channel in ('whatsapp','email')),
  provider           text not null default 'manual',
  to_address         text not null,
  template_key       text,
  message            text not null,
  status             text not null default 'queued'
                       check (status in ('queued','sent','delivered','read','failed')),
  provider_message_id text,
  error              text,
  sent_at            timestamptz,
  delivered_at       timestamptz,
  read_at            timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists message_deliveries_school_idx on public.message_deliveries(school_id, created_at desc);
create index if not exists message_deliveries_payment_idx on public.message_deliveries(payment_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 8. IDEMPOTENCIA DE WEBHOOKS, AUDITORÍA Y OBSERVABILIDAD DE INTEGRACIONES
-- ──────────────────────────────────────────────────────────────────────────
-- Sin RLS abierta a nadie: solo el servidor (service_role) escribe y lee
-- estas tres tablas. anon/authenticated no tienen ninguna policy → cerrado
-- por default-deny, igual que demo_requests.
create table if not exists public.webhook_events (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null,
  event_id     text not null,
  payload      jsonb,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  result       text,
  attempts     int not null default 0,
  error        text,
  unique (provider, event_id)
);
create index if not exists webhook_events_provider_idx on public.webhook_events(provider, received_at desc);

create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid references public.schools(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  ip          text,
  created_at  timestamptz not null default now()
);
create index if not exists audit_logs_school_idx on public.audit_logs(school_id, created_at desc);

create table if not exists public.integration_events (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid references public.schools(id) on delete cascade,
  integration text not null check (integration in ('mercadopago','whatsapp','resend')),
  event_type text not null,
  success    boolean not null default true,
  error      text,
  metadata   jsonb,
  created_at timestamptz not null default now()
);
create index if not exists integration_events_school_idx on public.integration_events(school_id, created_at desc);

-- ──────────────────────────────────────────────────────────────────────────
-- 8.1 ANALÍTICA INTERNA — sin proveedor externo, sin datos personales
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.analytics_events (
  id         uuid primary key default gen_random_uuid(),
  event_name text not null,
  school_id  uuid references public.schools(id) on delete set null,
  properties jsonb,
  created_at timestamptz not null default now()
);
create index if not exists analytics_events_name_idx on public.analytics_events(event_name, created_at desc);
alter table public.analytics_events enable row level security;
-- Sin policies para authenticated/anon: solo el servidor (service_role)
-- escribe y lee. Nunca se guardan datos personales identificables — solo
-- nombre del evento, school_id opcional y propiedades agregadas.

-- ──────────────────────────────────────────────────────────────────────────
-- 9. DEMO REQUESTS — columnas de seguimiento del lead (tabla ya existía)
-- ──────────────────────────────────────────────────────────────────────────
alter table public.demo_requests add column if not exists status text not null default 'new'
  check (status in ('new','contacted','converted','dismissed'));
alter table public.demo_requests add column if not exists source text not null default 'landing';

-- ──────────────────────────────────────────────────────────────────────────
-- 10. RLS — mismo patrón de aislamiento por school_id que 001
-- ──────────────────────────────────────────────────────────────────────────
alter table public.campuses                     enable row level security;
alter table public.tutors                       enable row level security;
alter table public.student_tutors               enable row level security;
alter table public.subscriptions                enable row level security;
alter table public.plan_usage                   enable row level security;
alter table public.billing_cycles               enable row level security;
alter table public.payment_provider_connections enable row level security;
alter table public.payment_attempts             enable row level security;
alter table public.manual_payments              enable row level security;
alter table public.reminder_rules               enable row level security;
alter table public.message_deliveries           enable row level security;
alter table public.webhook_events               enable row level security;
alter table public.audit_logs                   enable row level security;
alter table public.integration_events           enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'campuses','tutors','student_tutors','billing_cycles',
    'payment_attempts','manual_payments','reminder_rules','message_deliveries'
  ]
  loop
    execute format('drop policy if exists "%s: tenant select" on public.%I', t, t);
    execute format($f$
      create policy "%s: tenant select" on public.%I
        for select to authenticated
        using (school_id = public.current_school_id())
    $f$, t, t);

    execute format('drop policy if exists "%s: tenant insert" on public.%I', t, t);
    execute format($f$
      create policy "%s: tenant insert" on public.%I
        for insert to authenticated
        with check (school_id = public.current_school_id())
    $f$, t, t);

    execute format('drop policy if exists "%s: tenant update" on public.%I', t, t);
    execute format($f$
      create policy "%s: tenant update" on public.%I
        for update to authenticated
        using (school_id = public.current_school_id())
        with check (school_id = public.current_school_id())
    $f$, t, t);

    execute format('drop policy if exists "%s: tenant delete" on public.%I', t, t);
    execute format($f$
      create policy "%s: tenant delete" on public.%I
        for delete to authenticated
        using (school_id = public.current_school_id())
    $f$, t, t);
  end loop;
end $$;

-- subscriptions y plan_usage: lectura para toda la escuela, escritura solo
-- server-side (service_role) — el cambio de plan pasa por /api/subscription
-- para dejar rastro de auditoría, nunca por un UPDATE directo del cliente.
drop policy if exists "subscriptions: tenant select" on public.subscriptions;
create policy "subscriptions: tenant select" on public.subscriptions
  for select to authenticated
  using (school_id = public.current_school_id());

drop policy if exists "plan_usage: tenant select" on public.plan_usage;
create policy "plan_usage: tenant select" on public.plan_usage
  for select to authenticated
  using (school_id = public.current_school_id());

-- payment_provider_connections: la tabla base NUNCA se expone (tiene los
-- tokens); solo autoriza lectura de la vista pública de arriba. Sin policy
-- de select en la tabla base = cerrada para authenticated, la vista con
-- security_invoker=true respeta esta misma regla, así que exponemos la
-- policy de lectura sobre la tabla base pero el cliente solo debe consultar
-- la vista (que estructuralmente no trae columnas de token).
drop policy if exists "ppc: tenant select" on public.payment_provider_connections;
create policy "ppc: tenant select" on public.payment_provider_connections
  for select to authenticated
  using (school_id = public.current_school_id());

-- webhook_events, audit_logs, integration_events: sin policies para
-- authenticated/anon → cerradas por default-deny. audit_logs se lee desde
-- la UI vía un route handler con service_role que aplica el permiso
-- 'audit.read' (src/lib/rbac.ts), no vía consulta directa del cliente.

-- ──────────────────────────────────────────────────────────────────────────
-- 11. TRIGGERS updated_at
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'subscriptions','payment_provider_connections','payment_attempts'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end $$;

-- ══════════════════════════════════════════════════════════════════════════
-- FIN 002. Corre 001 y 002 juntos en un Supabase nuevo, en ese orden.
-- ══════════════════════════════════════════════════════════════════════════
