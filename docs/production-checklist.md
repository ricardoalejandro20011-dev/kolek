# Checklist de producción

Antes de piloteear con una escuela real y dinero real.

## Infraestructura

- [ ] Proyecto Supabase real creado y conectado (`NEXT_PUBLIC_SUPABASE_URL`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` en Vercel).
- [ ] Correr `supabase/schema.sql` y luego `supabase/migrations/002_kolek_v2.sql` en el SQL
      Editor de ese proyecto.
- [ ] `INTEGRATION_ENCRYPTION_KEY` generada (`openssl rand -hex 32`) y configurada en Vercel.
- [ ] `CRON_SECRET` configurado y verificado en `vercel.json` (ya apunta a
      `/api/cron/reminders` diario).

## Pagos

- [ ] App de Mercado Pago registrada, `MERCADOPAGO_CLIENT_ID/SECRET/REDIRECT_URI` configurados.
- [ ] Conectar Mercado Pago real desde una escuela piloto y confirmar en el panel de MP que la
      preference/cobro se crea correctamente (fuera de este entorno, que no tiene credenciales).
- [ ] Verificar los endpoints de OAuth contra la documentación vigente de Mercado Pago (ver
      `docs/integrations.md` — no se pudieron confirmar en vivo desde este entorno).
- [ ] Decidir y configurar la política de absorción de comisión por default para escuelas
      nuevas (`src/lib/fee-engine.ts::DEFAULT_FEE_CONFIG`) — hoy es `tutor_absorbs` con tarifas
      de arranque (3.5% + $3.00 + IVA) que deben validarse contra las tarifas reales vigentes de
      Mercado Pago.

## Mensajería

- [ ] Si se quiere envío automático: cuenta de WhatsApp Business, plantillas aprobadas en Meta
      Business Manager con los nombres esperados (`docs/integrations.md`), y
      `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` configurados.

## Suscripción / negocio

- [ ] Activar manualmente la suscripción de cada escuela piloto desde `/superadmin` (no hay
      proveedor de billing automático conectado todavía).
- [ ] Confirmar `TRIAL_DAYS` y `SUBSCRIPTION_GRACE_DAYS` con el criterio comercial real.

## Legal

- [ ] Completar Aviso de Privacidad y Términos con razón social, RFC, domicilio fiscal y
      representante legal reales de Ravela Group (hoy describen correctamente cómo opera el
      producto, pero les faltan esos datos formales).
- [ ] Definir un correo o WhatsApp de soporte real — `/contacto` hoy solo enlaza a `/demo` y a
      la web de Ravela Group.
- [ ] Revisar la Política de Cancelación con el equipo legal/comercial.

## Seguridad

- [ ] Revisar `docs/security.md` — en particular cifrar las columnas legacy de credenciales y
      evaluar rate limiting distribuido.
- [ ] Marcar `profiles.is_superadmin = true` únicamente para las cuentas del equipo de Kolek y
      configurar `SUPERADMIN_EMAILS`.

## Calidad

- [ ] `npm run lint && npm run typecheck && npm run test && npm run build` limpios (ya lo están
      en esta entrega).
- [ ] Pruebas de integración/E2E contra el Supabase real y un navegador — no ejecutadas en esta
      iteración por falta de esa infraestructura en este entorno.
- [ ] Revisión visual manual del dashboard, alumnos, settings y onboarding ya autenticados
      contra datos reales — no se pudo hacer en este entorno sin una sesión real de Supabase.
