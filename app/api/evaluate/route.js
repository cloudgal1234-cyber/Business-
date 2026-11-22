import { run, readJson, json } from '@/lib/engine';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(req) {
  const b = await readJson(req);
  if (!b.profile || !b.question) return json({ error: 'חסרים נתונים' }, 400);
  return json(await run('evaluateAnswer', [b], { preferDemo: b.demo }));
}
