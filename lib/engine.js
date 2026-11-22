import * as local from './local-engine.js';
import * as llm from './llm.js';

/**
 * Runs a task with Claude when an API key is configured (and the client didn't ask for demo mode),
 * otherwise — or if the API call fails — with the local rule-based engine.
 */
export async function run(task, args, { preferDemo = false } = {}) {
  if (llm.hasApiKey() && !preferDemo) {
    try {
      const data = await llm[task](...args);
      return { data, mode: 'ai' };
    } catch (err) {
      console.error(`[engine] Claude call "${task}" failed, falling back to demo engine:`, err?.message || err);
      const data = await local[task](...args);
      return { data, mode: 'demo', warning: 'החיבור ל-Claude נכשל — התוצאה הופקה במנוע המקומי.' };
    }
  }
  return { data: await local[task](...args), mode: 'demo' };
}

export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export const json = (body, status = 200) => Response.json(body, { status });
