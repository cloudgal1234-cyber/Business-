/**
 * Claude-powered engine. Used when ANTHROPIC_API_KEY is set.
 * Each function returns the exact same shape as lib/local-engine.js.
 */
import Anthropic from '@anthropic-ai/sdk';
import { CATEGORIES, CATEGORY_KEYS, LENGTHS, PERSONAS, labelForScore } from './constants.js';
import { computeStats } from './local-engine.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';
const EFFORT_OVERRIDE = process.env.ANTHROPIC_EFFORT;

let client;
const getClient = () => (client ||= new Anthropic());

export const hasApiKey = () => Boolean(process.env.ANTHROPIC_API_KEY);

/* ---------- JSON-schema helpers (structured outputs) ---------- */
const str = { type: 'string' };
const int = { type: 'integer' };
const arr = (items) => ({ type: 'array', items });
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const catEnum = { type: 'string', enum: CATEGORY_KEYS };

const BASE_SYSTEM = `You are the engine of "Investor Pitch Simulator", a Hebrew app that prepares founders for investor meetings.
Always write every user-facing string in natural, fluent Hebrew (English startup terms such as CAC, LTV, MRR, Moat, TAM are fine).
Ground everything in the business data you are given. Never invent facts about the business; when data is missing, use clearly marked placeholders in square brackets like [מספר לקוחות] so the founder fills them in.
Be concise, concrete and practical.`;

async function callJSON({ system, prompt, schema, effort = 'low', maxTokens = 8000 }) {
  const params = {
    model: MODEL,
    max_tokens: maxTokens,
    system: `${BASE_SYSTEM}\n\n${system}`,
    messages: [{ role: 'user', content: prompt }],
    output_config: { effort: EFFORT_OVERRIDE || effort, format: { type: 'json_schema', schema } },
  };
  let res;
  try {
    // Server-side refusal fallback: if the model declines, the API retries on a fallback model in the same call.
    res = await getClient().beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
  } catch (err) {
    if (err instanceof Anthropic.BadRequestError) {
      // e.g. a custom ANTHROPIC_MODEL that doesn't support fallbacks — retry plainly once
      res = await getClient().messages.create(params);
    } else throw err;
  }
  if (res.stop_reason === 'refusal') throw new Error('המודל סירב לבקשה');
  if (res.stop_reason === 'max_tokens') throw new Error('התשובה נקטעה (max_tokens)');
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text);
}

const profileBlock = (p) =>
  `<business_profile>\n${JSON.stringify(
    { ...p, _has: undefined },
    null,
    1
  )}\n</business_profile>`;

const personaBlock = (persona) =>
  persona === 'vc'
    ? `Investor persona: ${PERSONAS.vc.name} — a sharp, skeptical VC partner. Short, pointed, probing questions that demand numbers, evidence and specifics. Grade strictly: vague or number-free answers rarely exceed 5.`
    : `Investor persona: ${PERSONAS.angel.name} — a friendly, constructive angel. Warm, guiding questions. Grade fairly and encouragingly, but still honestly.`;

/* =========================== analyze =========================== */
const PROFILE_SCHEMA = obj({
  businessName: str,
  oneLiner: str,
  whatItDoes: str,
  targetAudience: str,
  businessModel: str,
  industry: str,
  products: arr(str),
  pricing: str,
  valueProposition: str,
  tractionSignals: arr(str),
  strengths: arr(str),
  gaps: arr(str),
});

export async function analyzeBusiness({ text, meta = {}, headings = [], url = '' }) {
  return callJSON({
    effort: 'medium',
    system: `Task: read the scraped website / pasted description of a business and build a structured business profile from an investor's point of view.
- whatItDoes: 1–2 sentences. targetAudience, businessModel: short, specific; say clearly if not stated on the site.
- pricing: quote prices found, or "לא מופיע באתר".
- tractionSignals: concrete evidence found (numbers, customers, testimonials); empty array if none.
- strengths: 3–5 things the site does well from an investor's perspective.
- gaps: 3–6 things an investor would look for that are missing or weak on the site (problem clarity, traction, pricing, moat, team, social proof...).`,
    prompt: `${url ? `URL: ${url}\n` : ''}${meta.title ? `Title: ${meta.title}\n` : ''}${meta.description ? `Meta description: ${meta.description}\n` : ''}${headings.length ? `Headings: ${headings.slice(0, 40).join(' | ')}\n` : ''}
<content>
${text}
</content>`,
    schema: PROFILE_SCHEMA,
  });
}

/* =========================== questions =========================== */
export async function generateQuestions(profile, persona = 'angel', length = 'short') {
  const per = LENGTHS[length]?.perCategory || 1;
  const cats = CATEGORIES.map((c) => `- ${c.key}: ${c.en} (${c.label}) — ${c.focus}`).join('\n');
  const out = await callJSON({
    effort: 'medium',
    system: `Task: write investor questions tailored to this specific business. ${personaBlock(persona)}
Categories:
${cats}
Write exactly ${per} question(s) per category, in the category order above (${per * 6} total).
Questions must reference the specific business (its product, audience, industry, and especially the gaps found on the website). The "risks" questions should target the website's gaps or the riskiest assumptions.
"why": one short Hebrew sentence explaining what the investor is really testing.
"id": "<category>-<n>".`,
    prompt: profileBlock(profile),
    schema: obj({ questions: arr(obj({ id: str, category: catEnum, question: str, why: str })) }),
  });
  return out;
}

/* =========================== evaluate =========================== */
const EVAL_SCHEMA = obj({
  score: int,
  strengths: arr(str),
  improvements: arr(str),
  improvedAnswer: str,
  followUp: str,
  coach: obj({ whyWeak: arr(str), guidingQuestions: arr(str), encouragement: str }),
});

export async function evaluateAnswer({ profile, question, category, answer, persona = 'angel', isFollowUp = false, previousAttempts = [] }) {
  const out = await callJSON({
    effort: 'low',
    system: `Task: grade a founder's answer to an investor question, like a real investor would. ${personaBlock(persona)}
- score: integer 1–10. "I don't know" / evasive / very short answers get 1–3. 8+ means investor-ready: specific, quantified, credible, concise.
- strengths: 1–3 specific things that worked (empty array if none). improvements: 2–4 specific, actionable fixes.
- improvedAnswer: an improved answer at the level of an experienced founder, in first person, ~80–130 words, using the business data; use [placeholders] for numbers you don't know.
- followUp: one follow-up question the investor would ask next, pressing on a specific point from the answer (like a real meeting).
- coach: written as a supportive pitch coach (not the investor). whyWeak: 1–3 clear reasons this answer would not convince an investor. guidingQuestions: 2–3 short questions that help the founder rebuild the answer from their own knowledge. encouragement: one warm sentence.`,
    prompt: `${profileBlock(profile)}
Category: ${category}${isFollowUp ? ' (this is a follow-up question)' : ''}
Investor question: ${question}
${previousAttempts.length ? `Previous attempt(s) by the founder: ${previousAttempts.map((a) => `"${a}"`).join(' / ')}\n` : ''}Founder's answer:
<answer>
${answer || '(empty)'}
</answer>`,
    schema: EVAL_SCHEMA,
  });
  out.score = Math.max(1, Math.min(10, Math.round(Number(out.score) || 1)));
  out.label = labelForScore(out.score).key;
  return out;
}

/* =========================== hints =========================== */
export async function generateHints({ profile, category, question, persona = 'angel' }) {
  return callJSON({
    effort: 'low',
    system: `Task: the founder is stuck on an investor question. Act as a supportive pitch coach and give 3 levels of help, without writing the full answer for them.
- intent (level 1): in plain, simple Hebrew, 2–3 sentences — what the investor is really checking with this question.
- skeleton (level 2): exactly 3 short steps for a winning answer, each formatted "what to say → guiding question", tailored to this business.
- opener (level 3): an opening sentence tailored to this business with ___ blanks for the founder to complete. ${personaBlock(persona)}`,
    prompt: `${profileBlock(profile)}\nCategory: ${category}\nInvestor question: ${question}`,
    schema: obj({ intent: str, skeleton: arr(str), opener: str }),
  });
}

/* =========================== summary =========================== */
export async function summarizeSession({ profile, items = [], persona = 'angel' }) {
  const stats = computeStats(items);
  const transcript = items
    .filter((i) => i.attempts?.length)
    .map((i) => {
      const best = i.attempts.reduce((b, a) => ((a.evaluation?.score || 0) > (b.evaluation?.score || 0) ? a : b), i.attempts[0]);
      return `[${i.category}] Q: ${i.question}\nA (best of ${i.attempts.length}, score ${best.evaluation?.score}/10, hint levels used: ${i.hintLevel || 0}): ${best.answer}`;
    })
    .join('\n\n');

  const out = await callJSON({
    effort: 'medium',
    maxTokens: 12000,
    system: `Task: write the "Pitch Readiness Summary" after a mock investor meeting. ${personaBlock(persona)}
- verdict: 1–2 sentences on overall readiness.
- businessStrengths: exactly 3 most notable strengths of the business/pitch.
- weakSpots: exactly 3 weakest points — prefer questions with low scores or where hints were used (or untouched categories). For each: question, category, score (integer, 0 if not answered), issue (short), preparedAnswer (a polished ~80–120 word first-person answer for the founder to memorize, based on the business data and what they said; [placeholders] for unknown numbers).
- websiteActions: 3–6 concrete changes to the website before sending it to investors.
- meetingActions: 3–5 concrete preparation steps for the meeting.`,
    prompt: `${profileBlock(profile)}
Category scores: ${JSON.stringify(stats.categoryScores)}
Readiness score (computed): ${stats.readiness}/100
<transcript>
${transcript || '(no answers yet)'}
</transcript>`,
    schema: obj({
      verdict: str,
      businessStrengths: arr(str),
      weakSpots: arr(obj({ question: str, category: catEnum, score: int, issue: str, preparedAnswer: str })),
      websiteActions: arr(str),
      meetingActions: arr(str),
    }),
  });
  out.weakSpots = (out.weakSpots || []).map((w) => ({ ...w, score: w.score || null }));
  return { ...stats, ...out };
}
