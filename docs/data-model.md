# Modelo de datos

Fuente de verdad: [`supabase/schema.sql`](../supabase/schema.sql) (base, MVP) +
[`supabase/migrations/002_kolek_v2.sql`](../supabase/migrations/002_kolek_v2.sql) (v2, aditiva).
Ningún dato ni tabla existente se destruyó al evolucionar el esquema.

## Tablas base (001)

| Tabla | Qué es |
|---|---|
| `schools` | La institución. `plan` (enum) sigue siendo la fuente de verdad de qué plan tiene contratado — `subscriptions.plan` debe reflejarlo siempre (se actualizan juntos, ver `/api/subscription/change-plan`). |
| `profiles` | Usuario del equipo escolar. `role`: `owner\|administrator\|collections\|viewer` (heredado: `admin\|staff`, ver `src/lib/rbac.ts::normalizeRole`). `is_superadmin` (v2): acceso al panel interno, se activa a mano. |
| `groups` | Agrupación libre de alumnos (grado, nivel, sede informal). |
| `students` | Alumno. Incluye tutor "principal" embebido (`nombre_tutor`, `whatsapp_tutor`, `email_tutor`) — sigue siendo lo que usa el 90% de la UI. |
| `concepts` | Qué se cobra (Colegiatura, Inscripción…). |
| `payments` | **Es la tabla de "charges"** — un cargo individual por alumno/concepto/ciclo. `UNIQUE(student_id, concept_id, ciclo)` = idempotencia de generación. v2 le agrega `billing_cycle_id`, `amount_centavos`, `total_centavos`, `paid_centavos`. |
| `whatsapp_logs` | Bitácora de envíos de WhatsApp que ya usa `/dashboard/whatsapp`. |

## Tablas nuevas (002 — v2)

| Tabla | Para qué |
|---|---|
| `campuses` | Multi-plantel (plan Pro). |
| `tutors` / `student_tutors` | Familias reales: un tutor con varios hijos, un alumno con varios tutores. Coexiste con el tutor embebido en `students` (no lo reemplaza todavía en la UI). |
| `subscriptions` | La mensualidad que la escuela le paga a **Kolek** — independiente del dinero de las colegiaturas. Un renglón vigente por escuela; el historial de cambios vive en `audit_logs`. |
| `plan_usage` | Snapshot de uso por periodo (alumnos activos, mensajes, cargos) para límites y reportes. |
| `billing_cycles` | Un renglón por cada "generar ciclo" — agrupa los `payments` que creó. |
| `payment_provider_connections` | Credenciales de proveedores de pago **cifradas** (AES-256-GCM). Nunca se lee desde el cliente — para eso existe `payment_provider_connections_public` (vista sin columnas de token). |
| `payment_attempts` | Un intento de cobro por proveedor (preference/checkout id, estado crudo). |
| `manual_payments` | Detalle rico de un pago registrado a mano (método, referencia, evidencia, quién lo capturó). |
| `reminder_rules` | Reglas de recordatorio por escuela (día relativo al vencimiento, plantilla, canal) — el motor de automatización rico hacia el que migrar; hoy el cron sigue usando `schools.recordatorios_dias`. |
| `message_deliveries` | Registro provider-agnóstico de envíos (WhatsApp/email) — el `MessagingProvider` escribe aquí. |
| `webhook_events` | Idempotencia de webhooks: `UNIQUE(provider, event_id)`. Sin RLS abierta — solo servidor. |
| `audit_logs` | Quién hizo qué, cuándo, antes/después. Sin secretos. |
| `integration_events` | Log de intentos de integración (éxito/error) para observabilidad. |
| `analytics_events` | Analítica interna del funnel, sin datos personales. |
| `demo_requests` | Leads del CTA "Solicitar demo", con `status`/`source`. |

## Dinero

Todo lo nuevo (`subscriptions`, `billing_cycles`, `payment_attempts`, columnas `*_centavos` de
`payments`) es **entero en centavos** (`bigint`/`integer`). Las columnas heredadas
(`monto_concepto`, `monto_default`, `monto_custom`, `monto_fijo`) siguen en `numeric(12,2)`
pesos — se convierten en el borde con `src/lib/money.ts`.

## Enums extendidos (no se rompió ningún valor existente)

- `member_role`: se agregaron `administrator`, `collections`, `viewer` (los viejos `admin`,
  `staff` se conservan como alias heredados).
- `payment_status`: se agregaron `procesando`, `parcial`, `cancelado`, `reembolsado`,
  `disputado` (los originales `pendiente`, `pagado`, `atrasado` siguen siendo los más usados).

## Zona horaria y moneda

`MXN` es la única moneda soportada. El huso objetivo es `America/Mexico_City` (fechas de
vencimiento, `expiration_date_to` de Mercado Pago se calcula en `-06:00`), pero el servidor
(Vercel) corre en UTC y el formateo de fechas usa `Intl` con locale `es-MX` sin fijar
explícitamente el timezone en cada punto — para un piloto en otro huso o con reportes sensibles
a la hora exacta, esto debe auditarse antes de confiar en él a ciegas.
