import { hasApiKey } from '@/lib/llm';
export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json({ ai: hasApiKey(), model: hasApiKey() ? process.env.ANTHROPIC_MODEL || 'claude-opus-5-5' : null });
}
