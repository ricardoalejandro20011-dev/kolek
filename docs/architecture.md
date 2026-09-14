# Arquitectura

## Capas

```
UI (App Router, Server + Client Components)
   │
   ├── Server Actions / Route Handlers  (src/app/api/**)
   │      │
   │      ├── RBAC          src/lib/rbac.ts            (autorización, servidor)
   │      ├── Suscripción   src/lib/subscriptions.ts   (acceso completo / gracia / bloqueado)
   │      ├── Auditoría     src/lib/audit.ts           (audit_logs)
   │      │
   │      ├── PaymentProvider    src/lib/payments/     (mock | mercadopago)
   │      ├── MessagingProvider  src/lib/messaging/     (manual | whatsapp_cloud | mock)
   │      ├── PaymentFeeEngine   src/lib/fee-engine.ts  (gross-up configurable)
   │      └── Money              src/lib/money.ts       (centavos enteros)
   │
   └── Supabase (Postgres + Auth)
          ├── RLS por school_id en toda tabla de negocio
          └── service_role SOLO en servidor (webhooks, /p/[token], cron, superadmin)
```

## Por qué adapters y no llamadas directas

La regla es: **ningún componente ni route handler de negocio importa un SDK de proveedor
externo directamente.** Siempre pasan por una interfaz (`PaymentProvider`,
`MessagingProvider`). Esto permite:

- Correr todo el flujo (cobro → checkout → conciliación → dashboard) sin ninguna credencial
  real, con `MockPaymentProvider` / `ManualWhatsAppProvider`.
- Agregar un proveedor nuevo (Openpay, STP, un ESP de correo) implementando la interfaz, sin
  tocar rutas ni componentes existentes.
- Que un cambio de credenciales o de proveedor en una escuela nunca afecte a otra — la decisión
  de qué proveedor usar se resuelve **por escuela**, no globalmente
  (`src/lib/payments/factory.ts::getPaymentProvider(schoolId)`).

## Flujo de un cobro, de punta a punta

1. **Generar ciclo** (`POST /api/payments/generate-cycle`): valida rol (`charges.generate`) y
   suscripción, crea un `billing_cycles` y un `payments` (= "charge") por alumno activo, con
   `UNIQUE(student_id, concept_id, ciclo)` — generar el mismo ciclo dos veces nunca duplica.
2. Para cada cargo, `asegurarIntentoDeCobro()` resuelve el `PaymentProvider` de la escuela y
   crea un `payment_attempts` + el checkout (preference de MP, o un registro mock).
3. El tutor abre `/p/[token]` (token no adivinable, service_role filtra por él — RLS sigue
   cerrado para `anon`). Ve el desglose exacto (`PaymentFeeEngine`) y paga (Wallet Brick real, o
   el panel de simulación en modo mock).
4. **Conciliación**: en modo real, `/api/webhooks/mercadopago` recibe el evento, lo guarda en
   `webhook_events` (idempotencia por `event_id`), consulta el pago contra la API de Mercado
   Pago (fuente de verdad, nunca se confía en el payload del webhook) y actualiza `payments`. En
   modo mock, `/api/payments/simulate` hace lo mismo sin ningún proveedor externo.
5. El dashboard lee `payments`/`v_payment_rows` — no hay caché ni estado duplicado que pueda
   desincronizarse.

## Multi-tenant

Cada tabla de negocio tiene `school_id`. Row Level Security en Postgres filtra por
`current_school_id()` (función `SECURITY DEFINER` que lee `profiles.school_id` del usuario
autenticado) en cada `SELECT/INSERT/UPDATE/DELETE`. El aislamiento no depende de que el
frontend "se porte bien" — ver [security.md](security.md).
