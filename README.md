# Kolek

**Cobranza escolar preventiva.** Cobra antes, concilia automáticamente, persigue menos.

SaaS B2B de cobranza para escuelas privadas de México — un producto de Ravela Group. Kolek
**no** es un ERP escolar ni reemplaza el sistema académico de la institución: centraliza
colegiaturas, automatiza recordatorios por WhatsApp y concilia cada pago, sin que Kolek
concentre nunca el dinero de las escuelas.

> El nombre de marca vive centralizado en [`src/config/brand.ts`](src/config/brand.ts).
> Identificadores internos (tablas, funciones SQL, algunas claves) siguen diciendo "colekta"
> porque así se llamaba el producto antes de este rebrand — renombrarlos exige su propia
> migración y no cambia nada para el usuario final.

## Índice

1. [Arquitectura](#1-arquitectura)
2. [Arranque rápido](#2-arranque-rápido)
3. [Variables de entorno](#3-variables-de-entorno)
4. [Base de datos: migraciones y RLS](#4-base-de-datos-migraciones-y-rls)
5. [Modo mock / modo demo — probar todo sin credenciales](#5-modo-mock--modo-demo)
6. [Activar Mercado Pago de verdad](#6-activar-mercado-pago-de-verdad)
7. [Activar WhatsApp Cloud API de verdad](#7-activar-whatsapp-cloud-api-de-verdad)
8. [Roles y permisos](#8-roles-y-permisos)
9. [Suscripción de la escuela a Kolek](#9-suscripción-de-la-escuela-a-kolek)
10. [Panel interno (superadmin)](#10-panel-interno-superadmin)
11. [Pruebas](#11-pruebas)
12. [Build y deploy](#12-build-y-deploy)
13. [Seguridad](#13-seguridad)
14. [Limitaciones conocidas](#14-limitaciones-conocidas)
15. [Checklist antes del primer piloto real](#15-checklist-antes-del-primer-piloto-real)

---

## 1. Arquitectura

- **Framework**: Next.js 14 (App Router) + TypeScript + Tailwind CSS.
- **Base de datos / Auth**: Supabase (Postgres + Auth + Storage). Un solo proyecto, sin segunda
  base de datos ni segundo sistema de autenticación.
- **Multi-tenant**: cada fila de cada tabla de negocio tiene `school_id`. Aislamiento real por
  Row Level Security en Postgres (no solo filtros de frontend) — ver
  [docs/security.md](docs/security.md).
- **Dinero**: todo lo nuevo se calcula y almacena en **centavos enteros** (`src/lib/money.ts`).
  Las columnas heredadas del MVP (`numeric(12,2)` en pesos) se mantienen por compatibilidad y se
  convierten en el borde.
- **Integraciones como adapters**: nada de lógica de negocio llama a un SDK de proveedor
  directo. Ver `src/lib/payments/` (`PaymentProvider`) y `src/lib/messaging/`
  (`MessagingProvider`). Detalle completo en [docs/integrations.md](docs/integrations.md).
- Documentación ampliada: [docs/architecture.md](docs/architecture.md) ·
  [docs/data-model.md](docs/data-model.md).

## 2. Arranque rápido

```bash
npm install
cp .env.example .env.local   # llena al menos las 3 de Supabase (ver sección 3)
npm run dev
```

Sin ninguna otra variable, Kolek arranca completo en **modo de prueba**: los pagos se simulan
de extremo a extremo (`PAYMENT_PROVIDER_MODE=mock` por default) y los recordatorios de WhatsApp
quedan listos para mandar a mano (`MESSAGING_PROVIDER_MODE=manual` por default).

## 3. Variables de entorno

Ver [`.env.example`](.env.example) — está agrupado y documentado, y se queda vacío a propósito
(nunca hay credenciales de ejemplo con forma de credencial real).

Solo 3 son **indispensables** para que la app arranque (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) — se validan al iniciar el
servidor (`instrumentation.ts` + `src/config/env.ts`), **nunca durante `next build`**. Todo lo
demás es opcional: su ausencia activa el modo mock/manual correspondiente.

## 4. Base de datos: migraciones y RLS

Corre, en este orden, en Supabase Dashboard › SQL Editor:

1. [`supabase/schema.sql`](supabase/schema.sql) — esquema base (schools, students, payments…).
2. [`supabase/migrations/002_kolek_v2.sql`](supabase/migrations/002_kolek_v2.sql) — campuses,
   tutors/familias, suscripciones, ciclos de cobro, conexiones de pago cifradas, auditoría,
   idempotencia de webhooks, analítica interna.

Ambos son **idempotentes**: se pueden correr varias veces sin romper nada. Detalle tabla por
tabla en [docs/data-model.md](docs/data-model.md).

## 5. Modo mock / modo demo

Con `PAYMENT_PROVIDER_MODE=mock` (default), cualquier link de pago público (`/p/[token]`)
muestra un panel "Modo de prueba" con botones para simular: **Aprobar, Rechazar, Dejar
pendiente, Reembolsar, Duplicar evento** (prueba de idempotencia). Ningún botón hace un cargo
real ni requiere ninguna credencial. El flujo completo —generar ciclo → link → "pago" → dashboard—
funciona de punta a punta así.

## 6. Activar Mercado Pago de verdad

Kolek usa **OAuth real** ("Conectar mi cuenta de Mercado Pago"), nunca pedirle a la escuela que
pegue un access token:

1. Registra una aplicación en el
   [panel de desarrolladores de Mercado Pago](https://www.mercadopago.com.mx/developers/panel/app)
   y copia `Client ID` / `Client secret`.
2. Genera una llave de cifrado: `openssl rand -hex 32`.
3. En `.env.local` / Vercel: `MERCADOPAGO_CLIENT_ID`, `MERCADOPAGO_CLIENT_SECRET`,
   `MERCADOPAGO_REDIRECT_URI` (`https://tu-dominio/api/integrations/mercadopago/callback`),
   `INTEGRATION_ENCRYPTION_KEY`.
4. Cada escuela entra a Ajustes › Integraciones y da clic en "Conectar mi cuenta de Mercado
   Pago". El access/refresh token quedan **cifrados en reposo** (AES-256-GCM,
   `src/lib/crypto.ts`) en `payment_provider_connections`, nunca en texto plano, nunca
   expuestos al cliente (la UI solo lee `payment_provider_connections_public`, una vista sin
   columnas de token).

Endpoints OAuth reales de Mercado Pago (verificar contra la documentación vigente antes de
producción — no se pudo confirmar en vivo desde este entorno de desarrollo):
`auth.mercadopago.com.mx/authorization` y `api.mercadopago.com/oauth/token`.

## 7. Activar WhatsApp Cloud API de verdad

`developers.facebook.com` › tu app › WhatsApp › Configuración de la API. Sin
`WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID`, cada recordatorio queda listo para
copiar/mandar por `wa.me` — nunca se marca "enviado" sin haberse mandado de verdad.

## 8. Roles y permisos

`owner` · `administrator` · `collections` · `viewer` — matriz completa y verificación en
servidor (nunca solo ocultar botones) en [`src/lib/rbac.ts`](src/lib/rbac.ts), con pruebas en
[`src/lib/rbac.test.ts`](src/lib/rbac.test.ts).

## 9. Suscripción de la escuela a Kolek

Independiente del dinero de las colegiaturas. Estados: `trialing → active → past_due →
suspended → canceled`. `TRIAL_DAYS` y `SUBSCRIPTION_GRACE_DAYS` son configurables. Fuera del
periodo de gracia, la escuela conserva lectura y exportación pero no puede generar cargos
nuevos (`src/lib/subscriptions.ts`). Mientras no exista un proveedor de billing conectado, la
activación es manual desde el [panel interno](#10-panel-interno-superadmin).

## 10. Panel interno (superadmin)

`/superadmin` — protegido por `profiles.is_superadmin = true` (se activa a mano en la base de
datos, nunca desde la app) + opcionalmente `SUPERADMIN_EMAILS`. Lista escuelas, MRR/ARR,
conversión de demos, salud de webhooks; toda acción (activar, suspender, cambiar plan, extender
prueba) pasa por `/api/superadmin/actions` y queda en `audit_logs`.

## 11. Pruebas

```bash
npm run test        # Vitest — unitarias puras, sin infraestructura externa
npm run lint
npm run typecheck
npm run build
```

Cubren motor de comisiones (gross-up), dinero en centavos, RBAC y estados de suscripción — ver
[`src/lib/*.test.ts`](src/lib). Pruebas de integración/E2E contra una base de datos y navegador
reales **no corren en este entorno** (no hay Supabase real conectado ni navegador headless
disponible) — quedan como trabajo pendiente, documentado en
[docs/production-checklist.md](docs/production-checklist.md).

## 12. Build y deploy

Desplegado en Vercel. `vercel.json` define el cron diario de `/api/cron/reminders`. El build
nunca falla por integraciones vacías; si faltan las 3 variables de Supabase, el *build* sigue
pasando pero el *servidor* se niega a arrancar en producción (mensaje claro en logs).

## 13. Seguridad

Ver [docs/security.md](docs/security.md) para el detalle completo (RLS, cifrado, rate limiting,
idempotencia de webhooks, qué falta).

## 14. Limitaciones conocidas

- No hay proyecto Supabase real conectado en este entorno — todo lo que depende de datos vive
  sin probar contra una base real.
- `schools.mp_access_token` / `schools.whatsapp_token` (columnas heredadas del MVP) siguen sin
  cifrar en reposo; la ruta nueva y recomendada es OAuth (`payment_provider_connections`,
  cifrada) para Mercado Pago. WhatsApp sigue usando el token pegado en Ajustes, server-side
  únicamente.
- El rate limiting de `/api/demo-request` es en memoria (mejor esfuerzo), no distribuido.
- Aviso de privacidad / Términos / Cancelación están escritos con contenido real pero **sin**
  razón social, RFC, domicilio fiscal ni representante legal de Ravela Group — pendiente de
  validación por el equipo legal antes de operar con escuelas reales.
- Reportes avanzados (aging, recuperación por grupo/concepto con tendencias), auditoría con
  vista propia en el dashboard, RBAC granular a nivel de UI (hoy es correcto a nivel servidor)
  y el módulo de facturación CFDI son roadmap, no funciones terminadas.

## 15. Checklist antes del primer piloto real

- [ ] Conectar un proyecto Supabase real y correr ambas migraciones.
- [ ] Configurar `INTEGRATION_ENCRYPTION_KEY`, `MERCADOPAGO_CLIENT_ID/SECRET/REDIRECT_URI`.
- [ ] Conectar Mercado Pago real desde Ajustes de una escuela piloto (no dejar `mock`).
- [ ] Configurar WhatsApp Cloud API si se quiere envío automático.
- [ ] Activar manualmente la suscripción de la escuela piloto desde `/superadmin`.
- [ ] Completar la validación legal de Aviso de privacidad / Términos con datos reales de
      Ravela Group.
- [ ] Definir un correo/WhatsApp de soporte real (hoy `/contacto` solo enlaza a `/demo`).
- [ ] Configurar `SUPERADMIN_EMAILS` y marcar `profiles.is_superadmin = true` para el equipo.

## Licencia

Código propietario de Kolek (Ravela Group). Todos los derechos reservados.
