import { run, readJson, json } from '@/lib/engine';
export const runtime = 'nodejs';
export const maxDuration = 90;
export async function POST(req) {
  const b = await readJson(req);
  if (!b.profile) return json({ error: 'חסר פרופיל עסק' }, 400);
  return json(await run('summarizeSession', [b], { preferDemo: b.demo }));
}
