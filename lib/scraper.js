import * as cheerio from 'cheerio';
import dns from 'node:dns/promises';
import net from 'node:net';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MAX_BYTES = 2_500_000;
const TIMEOUT_MS = 10_000;
const MAX_SUBPAGES = 4;
const MAX_TEXT = 24_000;

const SUBPAGE_HINTS = [
  { kind: 'about', re: /(about|who-we-are|our-story|company|team|אודות|מי-אנחנו|עלינו|הצוות|צוות)/i },
  { kind: 'pricing', re: /(pricing|prices|plans|price|מחיר|מחירון|תמחור|חבילות|מסלולים)/i },
  { kind: 'services', re: /(services|solutions|products|product|features|שירות|פתרונות|מוצר|יכולות)/i },
  { kind: 'customers', re: /(customers|clients|case-stud|testimonials|לקוחות|המלצות|סיפורי-הצלחה)/i },
];

export class ScrapeError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

/* ---------- SSRF guard: never fetch private / local addresses ---------- */
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 10 || a === 127 || a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
}

async function assertPublicUrl(u) {
  if (!['http:', 'https:'].includes(u.protocol)) throw new ScrapeError('רק כתובות http/https נתמכות', 'bad_url');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new ScrapeError('כתובות מקומיות לא נשלפות מהשרת. להדבקת תוכן של דף מקומי השתמשו במצב "הדבקת טקסט".', 'private');
  }
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => {
    throw new ScrapeError('לא הצלחתי למצוא את הדומיין. בדקו שהכתובת נכונה.', 'dns');
  });
  if (addrs.some((a) => isPrivateIp(a.address))) {
    throw new ScrapeError('הכתובת מצביעה לרשת פרטית/מקומית. השתמשו במצב "הדבקת טקסט".', 'private');
  }
}

export function normalizeUrl(raw) {
  let s = String(raw || '').trim();
  if (!s) throw new ScrapeError('לא הוזנה כתובת', 'bad_url');
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try {
    return new URL(s);
  } catch {
    throw new ScrapeError('הכתובת לא תקינה', 'bad_url');
  }
}

async function fetchHtml(startUrl) {
  let url = startUrl;
  for (let hop = 0; hop < 5; hop++) {
    await assertPublicUrl(url);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(url, {
        redirect: 'manual',
        signal: ctrl.signal,
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
        },
      });
    } catch (e) {
      clearTimeout(timer);
      throw new ScrapeError(e.name === 'AbortError' ? 'האתר לא הגיב בזמן' : 'לא ניתן להתחבר לאתר', 'network');
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      clearTimeout(timer);
      url = new URL(res.headers.get('location'), url);
      continue;
    }
    if (res.status === 401 || res.status === 403 || res.status === 429 || res.status === 503) {
      clearTimeout(timer);
      throw new ScrapeError(`האתר חוסם גישה אוטומטית (${res.status})`, 'blocked');
    }
    if (!res.ok) {
      clearTimeout(timer);
      throw new ScrapeError(`האתר החזיר שגיאה (${res.status})`, 'http');
    }
    const type = res.headers.get('content-type') || '';
    if (!/html|xml|text\/plain/i.test(type)) {
      clearTimeout(timer);
      throw new ScrapeError('הכתובת לא מחזירה דף אינטרנט', 'type');
    }
    const reader = res.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_BYTES) break;
        chunks.push(value);
      }
    } finally {
      clearTimeout(timer);
      reader.cancel().catch(() => {});
    }
    return { html: Buffer.concat(chunks).toString('utf8'), finalUrl: url };
  }
  throw new ScrapeError('יותר מדי הפניות (redirects)', 'redirects');
}

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

function parsePage(html, pageUrl) {
  const $ = cheerio.load(html);
  const meta = {
    title: clean($('title').first().text()),
    description: clean($('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content')),
    siteName: clean($('meta[property="og:site_name"]').attr('content')),
  };
  const links = [];
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href');
    const text = clean($(a).text());
    try {
      const abs = new URL(href, pageUrl);
      if (abs.host === pageUrl.host && /^https?:$/.test(abs.protocol)) links.push({ url: abs, text });
    } catch {}
  });
  $('script,style,noscript,svg,iframe,template').remove();
  const headings = [];
  $('h1,h2,h3').each((_, h) => {
    const t = clean($(h).text());
    if (t && t.length < 200) headings.push(t);
  });
  const blocks = [];
  const seen = new Set();
  $('h1,h2,h3,h4,p,li,blockquote,td,dt,dd,figcaption,button,a.btn,[class*="price"]').each((_, el) => {
    const t = clean($(el).text());
    if (t.length >= 3 && t.length < 600 && !seen.has(t)) {
      seen.add(t);
      blocks.push(t);
    }
  });
  let text = blocks.join('\n');
  if (text.length < 200) text = clean($('body').text());
  return { meta, headings: [...new Set(headings)].slice(0, 40), text, links };
}

function pickSubpages(links, base) {
  const picked = new Map();
  for (const { kind, re } of SUBPAGE_HINTS) {
    const hit = links.find((l) => {
      const p = decodeURIComponent(l.url.pathname + ' ' + l.text);
      return re.test(p) && l.url.pathname !== base.pathname && !/\.(pdf|jpg|png|zip)$/i.test(l.url.pathname);
    });
    if (hit) {
      const key = hit.url.origin + hit.url.pathname;
      if (!picked.has(key)) picked.set(key, { kind, url: new URL(key) });
    }
    if (picked.size >= MAX_SUBPAGES) break;
  }
  return [...picked.values()];
}

async function readerFallback(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch('https://r.jina.ai/' + url.href, {
      signal: ctrl.signal,
      headers: { Accept: 'text/plain', 'X-Return-Format': 'text' },
    });
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    return text.length > 150 ? text.slice(0, MAX_TEXT) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Scrapes the homepage + a few key subpages (about / pricing / services / customers).
 * Returns combined text ready for analysis.
 */
export async function scrapeSite(rawUrl) {
  const url = normalizeUrl(rawUrl);
  const useReader = process.env.READER_FALLBACK === 'true';
  const notes = [];
  let home;
  try {
    home = await fetchHtml(url);
  } catch (err) {
    // Fallback 1: try the www / non-www variant
    if (err instanceof ScrapeError && ['network', 'dns', 'http'].includes(err.code)) {
      const alt = new URL(url.href);
      alt.hostname = alt.hostname.startsWith('www.') ? alt.hostname.slice(4) : 'www.' + alt.hostname;
      try {
        home = await fetchHtml(alt);
        notes.push('נשלף דרך כתובת חלופית (' + alt.hostname + ')');
      } catch {}
    }
    // Fallback 2: optional external reader service
    if (!home && useReader && !['private', 'bad_url'].includes(err.code)) {
      const text = await readerFallback(url);
      if (text) {
        return { url: url.href, source: 'reader', pages: [{ url: url.href, kind: 'home' }], meta: {}, headings: [], text, notes: ['האתר חסם גישה ישירה — התוכן נשלף דרך שירות קריאה חלופי'] };
      }
    }
    if (!home) throw err;
  }

  const main = parsePage(home.html, home.finalUrl);
  const pages = [{ url: home.finalUrl.href, kind: 'home', title: main.meta.title }];
  const sections = [`### דף הבית (${home.finalUrl.href})\n${main.text}`];
  const headings = [...main.headings];

  const subs = pickSubpages(main.links, home.finalUrl);
  const results = await Promise.allSettled(subs.map((s) => fetchHtml(s.url).then((r) => ({ ...s, ...r }))));
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const p = parsePage(r.value.html, r.value.finalUrl);
    pages.push({ url: r.value.finalUrl.href, kind: r.value.kind, title: p.meta.title });
    sections.push(`### ${r.value.kind} (${r.value.finalUrl.href})\n${p.text}`);
    headings.push(...p.headings);
  }

  let text = sections.join('\n\n').slice(0, MAX_TEXT);
  let source = 'direct';

  // Fallback 3: JS-rendered sites return almost no text
  if (main.text.length < 250) {
    if (useReader) {
      const t = await readerFallback(home.finalUrl);
      if (t) {
        text = t;
        source = 'reader';
        notes.push('האתר נבנה ב-JavaScript — התוכן נשלף דרך שירות קריאה חלופי');
      }
    }
    if (source === 'direct') notes.push('נשלף מעט מאוד טקסט (ייתכן שהאתר נטען ב-JavaScript). לתוצאה מדויקת יותר מומלץ להדביק את תוכן האתר.');
  }

  return { url: home.finalUrl.href, source, pages, meta: main.meta, headings: [...new Set(headings)].slice(0, 60), text, notes };
}
