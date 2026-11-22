import { scrapeSite, ScrapeError } from '@/lib/scraper';
import { run, readJson, json } from '@/lib/engine';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req) {
  const { url, text, demo } = await readJson(req);
  let input;
  let source;
  if (text && String(text).trim().length >= 40) {
    input = { text: String(text).slice(0, 24000), url: '' };
    source = { type: 'text', chars: String(text).length, notes: [] };
  } else if (url) {
    try {
      const s = await scrapeSite(url);
      input = { text: s.text, meta: s.meta, headings: s.headings, url: s.url };
      source = { type: 'url', url: s.url, via: s.source, pages: s.pages, notes: s.notes, chars: s.text.length };
    } catch (err) {
      const msg = err instanceof ScrapeError ? err.message : 'שליפת האתר נכשלה';
      return json({ error: msg, code: err.code || 'scrape', suggestPaste: true }, 422);
    }
  } else {
    return json({ error: 'הזינו כתובת אתר או הדביקו לפחות כמה משפטים על העסק.' }, 400);
  }

  const result = await run('analyzeBusiness', [input], { preferDemo: demo });
  return json({ ...result, source });
}
