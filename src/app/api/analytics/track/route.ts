import { NextResponse } from 'next/server';
import { z } from 'zod';
import { track, type AnalyticsEvent } from '@/lib/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EVENTOS_PUBLICOS: AnalyticsEvent[] = [
  'landing_view',
  'cta_demo_click',
  'cta_plans_click',
  'demo_form_start',
  'demo_form_submit',
];

const Body = z.object({
  event: z.enum(EVENTOS_PUBLICOS as [AnalyticsEvent, ...AnalyticsEvent[]]),
  properties: z.record(z.unknown()).optional(),
});

/** POST /api/analytics/track — eventos del sitio público (sin sesión). */
export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    // La analítica nunca debe romper la experiencia del usuario.
    return NextResponse.json({ ok: true });
  }
  await track(body.event, body.properties);
  return NextResponse.json({ ok: true });
}
