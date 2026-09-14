'use client';

/** Fire-and-forget: nunca bloquea la UI ni lanza si falla. */
export function trackClient(event: string, properties?: Record<string, unknown>): void {
  try {
    void fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, properties }),
      keepalive: true,
    });
  } catch {
    // silencioso a propósito
  }
}
