import 'server-only';

/**
 * Rate limiter en memoria, de mejor esfuerzo, para endpoints públicos sin
 * sesión (/api/demo-request). NO es un rate limiter distribuido: en Vercel
 * cada instancia serverless tiene su propia memoria, así que un atacante
 * repartido entre varias invocaciones frías puede evadirlo parcialmente.
 * Es la primera capa (junto con el honeypot); para un límite robusto de
 * verdad se necesita Redis/Upstash — documentado como pendiente en
 * docs/security.md.
 */
const intentos = new Map<string, number[]>();

export interface RateLimitResult {
  ok: boolean;
  restantes: number;
}

export function checarRateLimit(clave: string): RateLimitResult {
  const ventanaMs = Number(process.env.RATE_LIMIT_WINDOW_SECONDS ?? 60) * 1000;
  const maximo = Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 5);
  const ahora = Date.now();

  const previos = (intentos.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
  if (previos.length >= maximo) {
    intentos.set(clave, previos);
    return { ok: false, restantes: 0 };
  }

  previos.push(ahora);
  intentos.set(clave, previos);

  // Housekeeping ocasional para no crecer sin límite en un proceso de larga vida.
  if (intentos.size > 5000) {
    for (const [k, v] of intentos) {
      if (v.every((t) => ahora - t >= ventanaMs)) intentos.delete(k);
    }
  }

  return { ok: true, restantes: maximo - previos.length };
}
