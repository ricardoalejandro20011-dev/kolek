# Integraciones

Ninguna integración es obligatoria. Sin credenciales, Kolek activa su modo mock/manual
correspondiente automáticamente — nunca falla el build, nunca intenta un cargo real, nunca
marca algo como "enviado" sin haberlo mandado de verdad.

## Pagos — `PaymentProvider` (`src/lib/payments/`)

| Implementación | Cuándo se usa | Estado |
|---|---|---|
| `MockPaymentProvider` | Siempre que no haya `MERCADOPAGO_CLIENT_ID/SECRET` a nivel plataforma, o la escuela no haya conectado su cuenta | **Real y funcional** — permite probar aprobar/rechazar/pendiente/reembolso/evento duplicado de extremo a extremo |
| `MercadoPagoProvider` | Escuela con conexión `connected` en `payment_provider_connections` | **Real** (OAuth + checkout + webhook + refund) — no probado contra credenciales reales de producción en este entorno |
| Openpay | — | **No implementado.** La interfaz `PaymentProvider` está lista para recibirlo; no existe código porque no hay documentación ni credenciales que consultar |
| STP | — | **No implementado.** Feature flag `stpEnabled` previsto en la arquitectura de la fase de conciliación SPEI; sin código todavía |

La decisión de qué proveedor usar es **por escuela** (`getPaymentProvider(schoolId)`), nunca
global — dos escuelas en la misma instancia pueden estar en modos distintos.

### OAuth de Mercado Pago

1. `GET /api/integrations/mercadopago/connect` — redirige a `auth.mercadopago.com.mx/authorization`
   con `client_id`, `redirect_uri`, `state` (uuid guardado en `integration_events` para ligar el
   callback a la escuela correcta sin confiar en nada que venga del navegador).
2. `GET /api/integrations/mercadopago/callback` — intercambia `code` por tokens en
   `api.mercadopago.com/oauth/token`, los cifra (`src/lib/crypto.ts`) y los guarda en
   `payment_provider_connections`.
3. `POST /api/integrations/mercadopago/disconnect` — borra los tokens, marca `disconnected`.

**Importante**: estos dos endpoints de OAuth se tomaron de la documentación pública conocida de
Mercado Pago para su flujo de marketplace/checkout aggregator, pero no se pudieron verificar en
vivo desde este entorno de desarrollo (sin acceso a internet ni credenciales reales). Antes de
activar en producción, confirmar contra
[developers.mercadopago.com](https://www.mercadopago.com.mx/developers) que las URLs y el
formato del intercambio de tokens siguen vigentes.

### Webhook de Mercado Pago

`POST /api/webhooks/mercadopago?school=<uuid>` — idempotente por `webhook_events(provider,
event_id)`; valida `x-signature` (HMAC) si `MERCADOPAGO_WEBHOOK_SECRET` está configurado, y
siempre reconsulta el pago contra la API de MP (nunca confía en el monto/estado que venga en el
payload del webhook).

## Mensajería — `MessagingProvider` (`src/lib/messaging/`)

| Implementación | Cuándo se usa | Estado |
|---|---|---|
| `ManualWhatsAppProvider` | Default — sin credenciales de WhatsApp Cloud | **Real** — arma el mensaje, deja el link `wa.me` listo, nunca miente sobre si se mandó |
| `WhatsAppCloudProvider` | Escuela o plataforma con `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` | **Real**, reutiliza la lógica que ya existía en el MVP |
| `MockMessagingProvider` | Solo con `MESSAGING_PROVIDER_MODE=mock` | Para demos internas — marca "enviado" sin llamar a ninguna API |

Plantillas: `src/lib/messaging/templates.ts`. Los nombres de plantilla de Meta
(`META_TEMPLATE_NAME`) son un mapeo propuesto (`kolek_*`) — deben existir y estar aprobadas en
Meta Business Manager antes de usarse en producción; no se inventó su aprobación.

## Email

Resend, opcional (`RESEND_API_KEY`). Sin configurar, Kolek no manda correo — WhatsApp es el
canal principal. No hay código de envío de email en esta iteración (solo la variable de entorno
reservada); las plantillas de correo (próximo vencimiento, recibo, estado de cuenta) son
roadmap.

## Facturación (CFDI)

**No implementado.** Kolek emite recibos internos (`/recibo/[token]`) que explícitamente
aclaran "esto no sustituye una factura CFDI". Un módulo de facturación real requiere un PAC
(Proveedor Autorizado de Certificación) autorizado por el SAT — no existe integración con
ninguno todavía y no se debe fingir que la hay.
