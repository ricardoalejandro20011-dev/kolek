/**
 * Corre UNA vez cuando arranca el proceso del servidor (`next start` o el
 * runtime de Vercel) — NUNCA durante `next build`. Es el lugar correcto para
 * fallar fuerte y claro si de plano falta algo indispensable, sin arriesgar
 * el build.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { validateRequiredEnv } = await import('@/config/env');
  const result = validateRequiredEnv();

  if (!result.ok) {
    const mensaje = [
      '╔══════════════════════════════════════════════════════════════╗',
      '║  Kolek no puede arrancar: faltan variables de entorno         ║',
      '╚══════════════════════════════════════════════════════════════╝',
      ...result.errors.map((e) => `  · ${e}`),
      '',
      'Configúralas en .env.local (desarrollo) o en Vercel > Settings >',
      'Environment Variables (producción). Ver .env.example.',
    ].join('\n');

    console.error(mensaje);

    // En producción de verdad, sin base de datos la app es inútil: mejor
    // que el proceso truene explícito a que sirva páginas rotas en silencio.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Variables de entorno requeridas ausentes. Ver logs arriba.');
    }
  }
}
