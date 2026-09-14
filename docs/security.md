# Seguridad

## Aislamiento multi-tenant

- Row Level Security en Postgres en toda tabla de negocio, filtrando por
  `school_id = current_school_id()` (función `SECURITY DEFINER` que lee la escuela del usuario
  autenticado desde `profiles`). No es un filtro de frontend: aunque alguien manipule la
  consulta desde el navegador, Postgres no devuelve filas de otra escuela.
- `service_role` (que ignora RLS) se usa **solo** en: webhooks, `/p/[token]` y `/recibo/[token]`
  (el tutor no tiene sesión), el cron de recordatorios, y el panel superadmin — siempre
  filtrando explícitamente por `school_id` o `link_token` en el código, nunca "trayendo todo".

## Credenciales de integraciones

- Mercado Pago (flujo nuevo, OAuth): tokens cifrados en reposo con AES-256-GCM
  (`src/lib/crypto.ts`), llave derivada de `INTEGRATION_ENCRYPTION_KEY`. Nunca se seleccionan
  desde el cliente — la UI solo lee `payment_provider_connections_public`, una vista sin
  columnas de token.
- **Gap conocido**: `schools.mp_access_token` y `schools.whatsapp_token` (columnas heredadas del
  MVP, todavía usadas por WhatsApp) NO están cifradas en la base de datos — viven en texto
  plano, aunque nunca se devuelven al cliente vía API y la UI las muestra como campo tipo
  password. Migrar WhatsApp a un modelo de conexión cifrada análogo al de Mercado Pago es
  trabajo pendiente.
- Ningún secreto se imprime en logs (`console.error` solo registra mensajes de error, nunca el
  valor de un token).

## Webhooks

- Mercado Pago: firma `x-signature` (HMAC-SHA256) validada cuando `MERCADOPAGO_WEBHOOK_SECRET`
  está configurado; si no, se reconsulta el pago contra la API de MP (fuente de verdad) en vez
  de confiar en el payload.
- WhatsApp: `X-Hub-Signature-256` validada cuando `WHATSAPP_APP_SECRET` está configurado.
- **Idempotencia real**: `webhook_events` con `UNIQUE(provider, event_id)` — un evento
  reprocesado no vuelve a tocar `payments`.

## Tokens públicos

`payments.link_token` es un UUID v4 (no adivinable, no secuencial) — es la única forma de
acceder a `/p/[token]` y `/recibo/[token]` sin sesión. No se expone ningún ID secuencial de base
de datos en URLs públicas.

## RBAC

Verificado en servidor (`src/lib/rbac.ts::assertCan`) en cada route handler que muta datos
sensibles (generar ciclo, registrar pago manual, exportar, cambiar plan, conectar/desconectar
integraciones). Ocultar un botón en el cliente nunca es la única defensa.

## Auditoría

`audit_logs` registra acciones críticas (generación de ciclos, pagos manuales, cambios de plan,
conexión/desconexión de integraciones, acciones de superadmin) con usuario, escuela, antes/
después y, cuando el hosting la expone, IP. Nunca se guardan secretos ahí.

## Rate limiting

- `/api/demo-request`: rate limiter **en memoria** por IP (`src/lib/rate-limit.ts`) + honeypot.
  Es de mejor esfuerzo — en un entorno serverless con múltiples instancias no es un límite
  distribuido de verdad. Para un límite robusto se necesita un store compartido (Redis/Upstash),
  no incluido en esta iteración.
- Los demás endpoints públicos (webhooks) se protegen por firma/secreto, no por rate limit.

## Superadmin

`/superadmin` exige `profiles.is_superadmin = true` (columna que solo se activa a mano en la
base de datos — nunca vía la app ni vía una variable de entorno leíble desde el navegador) y,
opcionalmente, que el correo esté en `SUPERADMIN_EMAILS`. Toda intervención pasa por
`/api/superadmin/actions` y queda auditada; el superadmin nunca modifica pagos de una escuela en
silencio.

## Lo que falta para un piloto con dinero real

1. Cifrar `schools.mp_access_token` / `whatsapp_token` o migrar por completo al modelo de
   conexión cifrada.
2. Rate limiting distribuido para endpoints públicos.
3. MFA para cuentas `owner`/`administrator` — no implementado en esta iteración.
4. CSRF explícito en formularios que mutan estado fuera de rutas API con `Content-Type:
   application/json` (Next.js + `SameSite` cookies mitigan buena parte, pero no se hizo una
   revisión dedicada).
5. Revisión de headers de seguridad (CSP, `Strict-Transport-Security`, etc.) a nivel de
   `next.config.mjs` — no configurados explícitamente todavía.
