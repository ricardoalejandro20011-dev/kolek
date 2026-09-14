import 'server-only';
import { z } from 'zod';

/**
 * ── VALIDACIÓN DE VARIABLES DE ENTORNO ──────────────────────────────────
 *
 * Regla del proyecto: el build (`next build`) NUNCA debe fallar por
 * variables de entorno faltantes o vacías — Vercel necesita poder construir
 * la app antes de que existan credenciales reales, y en local `next build`
 * debe funcionar recién clonado el repo.
 *
 * Por eso esta validación es LAZY: no corre al importar el módulo, corre
 * cuando algo la invoca explícitamente (`instrumentation.ts` al arrancar el
 * servidor, o un adapter de integración antes de usarse). `next build` no
 * arranca el servidor ni ejecuta `instrumentation.ts`, así que nunca la ve.
 *
 * "Requerida" aquí significa: sin esto, Kolek no puede funcionar como
 * aplicación (no hay sesión, no hay base de datos). Todo lo demás
 * (Mercado Pago, WhatsApp, Resend, analítica) es opcional a propósito: su
 * ausencia activa el modo mock/manual correspondiente, nunca rompe nada.
 */

const RequiredSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL debe ser una URL válida'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Falta NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Falta SUPABASE_SERVICE_ROLE_KEY'),
});

const OptionalSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  // Cifrado de credenciales de integraciones en reposo (payment_provider_connections).
  // Sin esta llave, Kolek se niega a GUARDAR una conexión real (ver src/lib/crypto.ts)
  // pero el resto de la app sigue funcionando en modo mock.
  INTEGRATION_ENCRYPTION_KEY: z.string().min(32).optional(),

  // Mercado Pago (OAuth de verdad, nunca "pega tu access token").
  MERCADOPAGO_CLIENT_ID: z.string().optional(),
  MERCADOPAGO_CLIENT_SECRET: z.string().optional(),
  MERCADOPAGO_REDIRECT_URI: z.string().url().optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),
  PAYMENT_PROVIDER_MODE: z.enum(['mock', 'mercadopago']).default('mock'),

  // WhatsApp Cloud API.
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default('v21.0'),
  MESSAGING_PROVIDER_MODE: z.enum(['manual', 'whatsapp_cloud', 'mock']).default('manual'),

  // Billing propio de Kolek (suscripción de la escuela).
  TRIAL_DAYS: z.coerce.number().int().positive().default(14),
  SUBSCRIPTION_GRACE_DAYS: z.coerce.number().int().nonnegative().default(7),
  BILLING_PROVIDER_MODE: z.enum(['manual', 'mock']).default('manual'),

  // Email.
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().optional(),

  // Cron / jobs internos.
  CRON_SECRET: z.string().optional(),

  // Panel interno.
  SUPERADMIN_EMAILS: z.string().optional(),

  // Rate limiting (demo público, endpoints anónimos).
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(5),

  // Analítica propia (tabla interna) — ver src/lib/analytics.ts.
  ANALYTICS_MODE: z.enum(['internal', 'disabled']).default('internal'),

  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type RequiredEnv = z.infer<typeof RequiredSchema>;
export type OptionalEnv = z.infer<typeof OptionalSchema>;

export interface EnvValidationResult {
  ok: boolean;
  missingRequired: string[];
  errors: string[];
}

/**
 * Valida únicamente lo indispensable. Se usa en instrumentation.ts al
 * arrancar `next start` (nunca durante `next build`) para fallar fuerte y
 * claro si de plano no hay forma de que la app funcione.
 */
export function validateRequiredEnv(): EnvValidationResult {
  const parsed = RequiredSchema.safeParse(process.env);
  if (parsed.success) return { ok: true, missingRequired: [], errors: [] };

  const missingRequired = parsed.error.issues.map((i) => String(i.path[0]));
  const errors = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
  return { ok: false, missingRequired, errors };
}

/** Config opcional siempre parseable — nunca truena, solo aplica defaults. */
export function getOptionalEnv(): OptionalEnv {
  return OptionalSchema.parse(process.env);
}

/** ¿Hay credenciales reales de Mercado Pago cargadas a nivel plataforma? */
export function mercadoPagoPlataformaConfigurada(env = getOptionalEnv()): boolean {
  return Boolean(env.MERCADOPAGO_CLIENT_ID && env.MERCADOPAGO_CLIENT_SECRET);
}

/** ¿Hay credenciales reales de WhatsApp Cloud API a nivel plataforma? */
export function whatsappPlataformaConfigurada(env = getOptionalEnv()): boolean {
  return Boolean(env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ACCESS_TOKEN);
}
