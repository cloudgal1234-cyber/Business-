import { run, readJson, json } from '@/lib/engine';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(req) {
  const { profile, persona = 'angel', length = 'short', demo } = await readJson(req);
  if (!profile) return json({ error: 'חסר פרופיל עסק' }, 400);
  return json(await run('generateQuestions', [profile, persona, length], { preferDemo: demo }));
}
