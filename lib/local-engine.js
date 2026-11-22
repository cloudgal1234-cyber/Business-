/**
 * Local "smart demo" engine — rule-based analysis that works with no API key.
 * Every function returns the same shape as the Claude-powered engine (lib/llm.js),
 * so the UI doesn't care which one produced the result.
 */
import { CATEGORIES, CATEGORY_KEYS, categoryByKey, LENGTHS, labelForScore, WEAK_THRESHOLD } from './constants.js';

/* =========================== helpers =========================== */
const rx = (words) => new RegExp(words.join('|'), 'i');
const count = (text, re) => (text.match(new RegExp(re.source, 'gi')) || []).length;
const pick = (arr, seed = 0) => arr[Math.abs(seed) % arr.length];
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
const uniq = (a) => [...new Set(a.filter(Boolean))];
const trimTo = (s, n) => (s && s.length > n ? s.slice(0, n - 1).trim() + '…' : s);

const INDUSTRIES = [
  { label: 'פינטק / שירותים פיננסיים', words: ['תשלום', 'סליקה', 'פיננס', 'הלוואה', 'השקעות', 'ביטוח', 'חשבונית', 'הנהלת חשבונות', 'fintech', 'payment', 'invoice', 'banking', 'insurance', 'accounting'] },
  { label: 'בריאות ורפואה דיגיטלית', words: ['בריאות', 'רפואי', 'מטופל', 'קליניקה', 'רופא', 'טיפול', 'תזונה', 'כושר', 'health', 'medical', 'patient', 'clinic', 'wellness', 'fitness'] },
  { label: 'חינוך ולמידה', words: ['קורס', 'למידה', 'תלמיד', 'סטודנט', 'הדרכה', 'מורה', 'שיעור', 'course', 'learning', 'students', 'education', 'training'] },
  { label: 'מסחר אונליין / קמעונאות', words: ['חנות', 'עגלה', 'משלוח', 'קנייה', 'מוצרים שלנו', 'מבצע', 'shop', 'cart', 'shipping', 'store', 'checkout'] },
  { label: 'נדל״ן', words: ['נדל"ן', 'נדל״ן', 'דירה', 'דירות', 'נכס', 'שכירות', 'real estate', 'property', 'rent'] },
  { label: 'מזון ומסעדנות', words: ['מסעדה', 'אוכל', 'מתכון', 'קייטרינג', 'שף', 'משלוחי אוכל', 'restaurant', 'food', 'catering', 'menu'] },
  { label: 'שיווק ופרסום', words: ['שיווק', 'פרסום', 'קמפיין', 'לידים', 'סושיאל', 'seo', 'marketing', 'ads', 'campaign', 'leads'] },
  { label: 'תוכנה / SaaS לעסקים', words: ['מערכת', 'פלטפורמה', 'תוכנה', 'אוטומציה', 'דשבורד', 'ענן', 'api', 'saas', 'platform', 'software', 'automation', 'dashboard', 'cloud', 'ai', 'בינה מלאכותית'] },
  { label: 'משפטים ורגולציה', words: ['עורך דין', 'עורכי דין', 'משפטי', 'חוזה', 'רגולציה', 'legal', 'lawyer', 'contract', 'compliance'] },
  { label: 'תיירות ופנאי', words: ['טיול', 'מלון', 'חופשה', 'אירוח', 'תיירות', 'travel', 'hotel', 'vacation', 'booking'] },
  { label: 'שירותים מקצועיים / ייעוץ', words: ['ייעוץ', 'יועץ', 'ליווי', 'סדנה', 'אימון', 'consulting', 'coaching', 'agency', 'workshop'] },
];

const MODELS = [
  { key: 'subscription', label: 'מנוי חודשי/שנתי (Subscription)', words: ['מנוי', 'לחודש', 'בחודש', 'חודשי', 'שנתי', 'subscription', '/month', 'per month', '/mo', 'monthly', 'annual', 'plan'] },
  { key: 'freemium', label: 'Freemium — חינם עם שדרוג בתשלום', words: ['חינם', 'ללא עלות', 'free plan', 'free forever', 'try for free', 'נסו בחינם', 'free trial'] },
  { key: 'ecommerce', label: 'מכירת מוצרים ישירה (E-commerce)', words: ['הוסף לסל', 'עגלה', 'לקנייה', 'משלוח חינם', 'add to cart', 'buy now', 'shop now', 'checkout'] },
  { key: 'marketplace', label: 'מרקטפלייס — עמלה על עסקאות', words: ['ספקים', 'נותני שירות', 'עמלה', 'marketplace', 'commission', 'vendors', 'sellers', 'hosts'] },
  { key: 'services', label: 'שירותים / פרויקטים בתשלום לפי עבודה', words: ['הצעת מחיר', 'פגישת ייעוץ', 'ייעוץ', 'ריטיינר', 'לפי שעה', 'consultation', 'get a quote', 'retainer', 'agency'] },
  { key: 'enterprise', label: 'מכירה ארגונית (Enterprise / רישוי)', words: ['enterprise', 'ארגונים', 'רישיון', 'license', 'request a demo', 'תיאום הדגמה', 'הדגמה', 'book a demo', 'דמו'] },
  { key: 'ads', label: 'מבוסס פרסום/תוכן', words: ['פרסמו אצלנו', 'advertise', 'sponsored', 'חסות', 'מגזין'] },
];

const AUDIENCES = [
  { label: 'עסקים קטנים ובינוניים', words: ['עסקים קטנים', 'בעלי עסקים', 'עסק קטן', 'small business', 'smb', 'freelancers', 'עצמאים'] },
  { label: 'ארגונים וחברות גדולות', words: ['ארגונים', 'חברות גדולות', 'enterprise', 'corporate', 'ארגון'] },
  { label: 'צוותים ומחלקות בחברות', words: ['צוותים', 'צוות', 'teams', 'מנהלים', 'managers', 'hr', 'משאבי אנוש', 'מכירות'] },
  { label: 'סטארטאפים ויזמים', words: ['סטארטאפ', 'יזמים', 'startup', 'founders', 'entrepreneurs'] },
  { label: 'הורים ומשפחות', words: ['הורים', 'ילדים', 'משפחה', 'parents', 'kids', 'family'] },
  { label: 'סטודנטים ולומדים', words: ['סטודנטים', 'תלמידים', 'students', 'learners'] },
  { label: 'אנשי מקצוע בתחום הבריאות', words: ['רופאים', 'מטפלים', 'קליניקות', 'doctors', 'therapists', 'clinics'] },
  { label: 'צרכנים פרטיים', words: ['לקוחות פרטיים', 'לבית', 'אישי', 'consumers', 'personal', 'לכל אחד'] },
];

const RE = {
  price: /(₪\s?\d[\d,.]*|\d[\d,.]*\s?(₪|ש["״']?ח|שקלים|NIS)|\$\s?\d[\d,.]*|\d[\d,.]*\s?\$|€\s?\d[\d,.]*|\d[\d,.]*\s?€)/i,
  priceWords: rx(['מחיר', 'מחירון', 'תמחור', 'pricing', 'price', 'חבילת', 'מסלול']),
  traction: /(\d[\d,.]*\s?(\+|K|k|M|אלף|מיליון)?\s?(לקוחות|משתמשים|עסקים|חברות|הורדות|מנויים|תלמידים|מטופלים|customers|users|clients|companies|downloads|businesses|members))/i,
  testimonials: rx(['המלצות', 'ממליצים', 'לקוחות מספרים', 'מה אומרים', 'testimonial', 'what our customers', 'reviews', 'ביקורות', 'trusted by', 'סומכים עלינו', 'case study', 'סיפורי הצלחה']),
  team: rx(['מייסד', 'מייסדת', 'מייסדים', 'הצוות שלנו', 'הצוות', 'אנחנו צוות', 'founder', 'co-founder', 'our team', 'ceo', 'מנכ"ל', 'מנכ״ל']),
  problem: rx(['בעיה', 'כאב', 'מתקשים', 'מבזבזים', 'קשה', 'מתסכל', 'במקום', 'בלי ', 'סוף ל', 'נמאס', 'problem', 'struggle', 'pain', 'waste', 'frustrat', 'hassle', 'tired of']),
  benefit: rx(['חוסך', 'חוסכ', 'חסכ', 'חיסכון', 'מקצר', 'מגדיל', 'מוריד', 'משפר', 'יותר מהר', 'בקלות', 'save', 'faster', 'increase', 'reduce', 'boost', 'grow']),
  moat: rx(['היחידים', 'הראשונים', 'ייחודי', 'פטנט', 'בניגוד ל', 'טכנולוגיה ייחודית', 'קנייני', 'only ', 'first ', 'unique', 'patent', 'proprietary', 'unlike']),
  cta: rx(['צור קשר', 'צרו קשר', 'התחילו', 'הירשמו', 'הדגמה', 'דמו', 'לתיאום', 'contact', 'get started', 'sign up', 'book', 'demo', 'try']),
  press: rx(['כפי שפורסם', 'בתקשורת', 'כתבו עלינו', 'as seen', 'featured in', 'press', 'awards', 'פרס']),
};

function scoreList(text, list) {
  return list
    .map((x) => ({ ...x, hits: x.words.reduce((n, w) => n + count(text, new RegExp(w.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'))), 0) }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits);
}

const GENERIC_HEADINGS = rx(['צור קשר', 'צרו קשר', 'אודות', 'בית', 'תפריט', 'כניסה', 'הרשמה', 'שאלות נפוצות', 'מדיניות', 'תנאי', 'נגישות', 'contact', 'about', 'home', 'menu', 'login', 'sign', 'faq', 'privacy', 'terms', 'cookie', 'blog', 'בלוג', 'copyright', 'כל הזכויות', 'learn more', 'read more', 'למידע נוסף', 'קראו עוד', 'לפרטים', 'see all', 'view all']);

// Returns whole sentences containing a match (clean, readable evidence snippets)
function snippetsAround(text, re, max = 3) {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  return uniq(sentences.filter((x) => re.test(x)).map((x) => trimTo(x, 140))).slice(0, max);
}

// Most frequent capitalized Latin word (brand names like "TaskFlow" in Hebrew text)
function latinBrand(text) {
  const counts = {};
  for (const m of text.matchAll(/\b[A-Z][a-zA-Z0-9]{2,}\b/g)) counts[m[0]] = (counts[m[0]] || 0) + 1;
  const top = Object.entries(counts).filter(([w, n]) => n >= 2 && !/^(AI|API|SaaS|CRM|The|And|For)$/.test(w)).sort((a, b) => b[1] - a[1])[0];
  return top?.[0] || '';
}

/* =========================== analyze =========================== */
export function analyzeBusiness({ text = '', meta = {}, headings = [], url = '' }) {
  const body = String(text);
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  let domain = '';
  try { domain = url ? new URL(url).hostname.replace(/^www\./, '') : ''; } catch {}

  const titleParts = (meta.title || '').split(/\s[|–—\\-]\s|\|/).map((x) => x.trim()).filter(Boolean);
  const titleName = titleParts.find((x) => !/^(home|homepage|דף הבית|ראשי|בית|welcome)$/i.test(x)) || '';
  const firstLineHead = (lines[0] || '').replace(/^#+\s*/, '').split(/\s[|–—-]\s/)[0].trim();
  const firstLineName = firstLineHead.length <= 40 ? firstLineHead : '';
  const businessName = trimTo(meta.siteName || titleName || latinBrand(body) || firstLineName || (domain ? domain.split('.')[0] : '') || 'העסק שלך', 50);

  const longHeadings = headings.filter((h) => h.length > 15 && !GENERIC_HEADINGS.test(h));
  const firstSentence = (body.match(/[^.!?\n]{25,220}[.!?]/) || [])[0];
  const oneLiner = trimTo(meta.description || longHeadings[0] || firstSentence || lines.find((l) => l.length > 30) || '', 220);

  const industry = scoreList(body, INDUSTRIES)[0]?.label || 'לא זוהה בבירור';
  const models = scoreList(body, MODELS);
  const audiences = scoreList(body, AUDIENCES);

  const titleLike = headings.length
    ? headings
    : [
        ...((lines[0] || '').split(/\s[|–—-]\s/).slice(1)),
        ...lines.slice(1).filter((l) => l.length <= 60 && !/[.!?:]$/.test(l)),
        ...(body.match(/(חבילת|מסלול|plan)\s[^\s,.]+/gi) || []),
      ];
  const productCandidates = titleLike
    .map((h) => h.trim())
    .filter((h) => h.length >= 3 && h.length <= 60 && !GENERIC_HEADINGS.test(h) && h !== businessName)
    .slice(headings.length ? 1 : 0, 9);
  const products = uniq(productCandidates).slice(0, 5);

  const priceSnips = snippetsAround(body, RE.price, 2);
  const hasPrice = priceSnips.length > 0;
  const tractionSnips = snippetsAround(body, RE.traction, 3);
  const has = {
    pricing: hasPrice || RE.priceWords.test(body),
    traction: tractionSnips.length > 0,
    testimonials: RE.testimonials.test(body) || /["“״][^"”״]{10,200}["”״]\s*[—–-]\s*\S+/.test(body),
    team: RE.team.test(body),
    problem: RE.problem.test(body),
    benefit: RE.benefit.test(body),
    moat: RE.moat.test(body),
    cta: RE.cta.test(body),
    press: RE.press.test(body),
    rich: body.length > 1500,
  };

  const targetAudience = audiences.length
    ? audiences.slice(0, 2).map((a) => a.label).join(' / ')
    : 'לא מוגדר במפורש באתר';
  const businessModel = models.length
    ? models.slice(0, 2).map((m) => m.label).join(' + ')
    : 'לא ברור מהאתר איך העסק גובה כסף';

  const strengths = [];
  if (has.benefit) strengths.push('האתר מדגיש תועלת ברורה ללקוח (חיסכון / שיפור)');
  if (has.problem) strengths.push('יש התייחסות לבעיה או לכאב של הלקוח');
  if (has.traction) strengths.push('מופיעים נתוני משיכה (מספר לקוחות/משתמשים)');
  if (has.testimonials) strengths.push('יש הוכחה חברתית — המלצות או לקוחות מוכרים');
  if (has.pricing) strengths.push('התמחור שקוף ומופיע באתר');
  if (has.moat) strengths.push('האתר טוען לבידול / ייחודיות מול המתחרים');
  if (has.team) strengths.push('הצוות או המייסדים מוצגים');
  if (has.press) strengths.push('יש אזכורים בתקשורת / פרסים');
  if (has.cta) strengths.push('יש קריאה ברורה לפעולה (הרשמה / הדגמה / יצירת קשר)');
  if (strengths.length < 2) strengths.push('יש בסיס של תוכן שאפשר לבנות עליו סיפור השקעה');

  const gaps = [];
  if (!has.problem) gaps.push('לא מוצגת בבירור הבעיה שהעסק פותר ולמי היא כואבת');
  if (!has.traction) gaps.push('אין נתוני משיכה — מספר לקוחות, צמיחה, פיילוטים או הכנסות');
  if (!has.pricing) gaps.push('אין מידע על תמחור / איך העסק מרוויח כסף');
  if (!has.moat) gaps.push('לא ברור מה הבידול מול מתחרים ולמה קשה להעתיק');
  if (!has.testimonials) gaps.push('חסרה הוכחה חברתית — המלצות, לוגואים של לקוחות, Case Studies');
  if (!has.team) gaps.push('לא מוצג הצוות / המייסדים והניסיון הרלוונטי שלהם');
  if (!has.cta) gaps.push('אין קריאה ברורה לפעולה');
  if (!has.rich) gaps.push('יש מעט תוכן — קשה להבין לעומק את המוצר ואת היקפו');

  const whatItDoes = oneLiner
    ? `${businessName}: ${oneLiner}`
    : `${businessName} — לא נמצא תיאור קצר וברור של מה העסק עושה.`;

  return {
    businessName,
    oneLiner: oneLiner || 'לא נמצא משפט מפתח ברור',
    whatItDoes,
    targetAudience,
    businessModel,
    industry,
    products: products.length ? products : ['לא זוהו מוצרים/שירותים בשמם'],
    pricing: hasPrice ? priceSnips.join(' · ') : has.pricing ? 'יש אזכור לתמחור אך בלי מחירים מפורשים' : 'לא מופיע באתר',
    valueProposition: longHeadings[0] || oneLiner || 'לא נמצאה הצעת ערך מנוסחת',
    tractionSignals: tractionSnips.length ? tractionSnips : has.testimonials ? ['יש המלצות לקוחות, בלי מספרים'] : [],
    strengths: strengths.slice(0, 5),
    gaps: gaps.slice(0, 6),
    _has: has,
  };
}

/* =========================== questions =========================== */
const ctx = (p) => {
  const product = p.products?.[0] && !p.products[0].startsWith('לא זוהו') ? p.products[0] : 'המוצר';
  const audience = p.targetAudience && !p.targetAudience.startsWith('לא') ? p.targetAudience.split(/\s*[/,]\s*/)[0] : 'הלקוחות שלכם';
  return { name: p.businessName || 'העסק', product, audience, industry: p.industry || 'התחום' };
};
// Fills {placeholders}; adds a maqaf after a Hebrew prefix letter before a Latin name ("ב-TaskFlow")
const fill = (t, c) =>
  t.replace(/\{(\w+)\}/g, (_, k, off) => {
    const v = c[k] ?? '';
    return /[בלמשהוכ]/.test(t[off - 1] || '') && /^[A-Za-z0-9]/.test(v) && (off < 2 || /\s/.test(t[off - 2])) ? '-' + v : v;
  });

const BANK = {
  problem: {
    angel: [
      'ספרו לי בפשטות — איזו בעיה {name} פותר, ולמי היא הכי כואבת היום?',
      'איך {audience} מתמודדים עם הבעיה הזו היום, לפני {name}? מה הכי מתסכל אותם בפתרון הנוכחי?',
      'מה גרם לכם להבין שהבעיה הזו שווה בניית עסק שלם? היה רגע מסוים?',
    ],
    vc: [
      'כמה הבעיה הזו עולה ל{audience} — בכסף או בשעות בחודש? תנו לי מספר.',
      'אם {name} ייעלם מחר — מה בדיוק הלקוחות שלכם יפסידו? זה "Nice to have" או "Must have"?',
      'למה עכשיו? מה השתנה בשוק שהופך את {product} לרלוונטי דווקא היום ולא לפני 5 שנים?',
    ],
  },
  market: {
    angel: [
      'מי המתחרים העיקריים שלכם, ומה גורם ללקוח לבחור דווקא ב{name}?',
      'כמה גדול השוק שאתם פונים אליו, ואיפה אתם רוצים להתחיל לכבוש אותו?',
    ],
    vc: [
      'מה ה-Moat שלכם? אם חברה גדולה עם תקציב פי 100 תחליט להעתיק את {product} מחר בבוקר — למה היא לא תנצח?',
      'תנו לי TAM / SAM / SOM. איך חישבתם, ומה החלק הריאלי שתתפסו ב-3 שנים?',
      'שוק ה{industry} רווי. מה אתם יודעים שהמתחרים לא יודעים?',
    ],
  },
  model: {
    angel: [
      'איך {name} מרוויח כסף? מי משלם, כמה, וכל כמה זמן?',
      'מה עולה לכם להביא לקוח חדש, וכמה הוא שווה לכם לאורך זמן?',
    ],
    vc: [
      'תנו לי את ה-Unit Economics: מה ה-CAC, מה ה-LTV ומה היחס ביניהם? אם אין לכם עדיין — מה ההנחות?',
      'מה הגרוס מרג׳ין שלכם היום, ואיך הוא ישתנה בסקייל?',
      'למה המחיר שלכם נכון? בדקתם רגישות למחיר, או שקבעתם לפי מתחרים?',
    ],
  },
  traction: {
    angel: [
      'מה כבר הצלחתם להוכיח? ספרו לי על הלקוחות או המשתמשים הראשונים שלכם.',
      'איזה פידבק קיבלתם מלקוחות, ומה שיניתם בעקבותיו?',
    ],
    vc: [
      'תנו לי מספרים: כמה לקוחות משלמים, MRR/הכנסות, וקצב צמיחה חודשי.',
      'מה שיעור הנטישה (Churn) והשימור שלכם? כמה לקוחות חוזרים או מחדשים?',
      'פיילוטים זה נחמד — כמה מהם הפכו ללקוחות משלמים, ותוך כמה זמן?',
    ],
  },
  funds: {
    angel: [
      'כמה אתם מגייסים, ועל מה הכסף ילך בעיקר?',
      'איפה תרצו ש{name} יהיה בעוד 12–18 חודשים, ואיך ההשקעה מקרבת אתכם לשם?',
    ],
    vc: [
      'למה אתם צריכים את הכסף דווקא עכשיו? מה ה-Milestone שהסבב הזה קונה, ומה הראנוויי?',
      'פרקו לי את השימוש בכסף באחוזים. ומה יהיו המדדים שיצדיקו את הסבב הבא?',
    ],
  },
  risks: {
    angel: [
      'מה לדעתכם הסיכון הכי גדול לעסק, ואיך אתם מתכוננים אליו?',
      'מה הדבר שהכי מטריד אתכם בלילה לגבי {name}?',
    ],
    vc: [
      'מה ההנחה הכי מסוכנת בתוכנית העסקית שלכם — זו שאם היא שגויה, הכל קורס?',
      'למה דווקא הצוות הזה? מה הופך אתכם לאנשים הנכונים לנצח בשוק הזה?',
    ],
  },
};

const GAP_QUESTIONS = [
  { re: /תמחור|מרוויח/, angel: 'שמתי לב שאין באתר מידע על מחירים. איך אתם מתמחרים, ולמה בחרתם לא לפרסם את זה?', vc: 'אין מחירים באתר. זה מסתיר משהו? כמה בדיוק לקוח משלם ולמה הוא מוכן לשלם את זה?' },
  { re: /נתוני משיכה/, angel: 'באתר לא מופיעים נתונים על לקוחות או צמיחה. מה המספרים שהייתם רוצים להראות לי?', vc: 'לא ראיתי באתר אף מספר — לא לקוחות, לא צמיחה. איך אני יודע שמישהו בכלל רוצה את זה?' },
  { re: /בידול/, angel: 'מהאתר לא ברור לי מה מבדל אתכם מאחרים. איך הייתם מסבירים את זה במשפט?', vc: 'קראתי את האתר ולא הבנתי למה אתם שונים מכל השאר. שכנעו אותי ב-30 שניות.' },
  { re: /הצוות/, angel: 'באתר לא מוצג הצוות. ספרו לי מי אתם ולמה אתם האנשים הנכונים?', vc: 'אני משקיע באנשים. האתר לא אומר מי אתם. למה אתם, ולא צוות אחר?' },
  { re: /הוכחה חברתית/, angel: 'אין באתר המלצות של לקוחות. יש לקוחות מרוצים שהייתם יכולים לחבר אותי אליהם?', vc: 'אין אף המלצה או לוגו של לקוח באתר. אם אבקש עכשיו טלפון של שלושה לקוחות — תוכלו לתת?' },
  { re: /הבעיה/, angel: 'מהאתר לא ברור לי איזו בעיה אתם פותרים. תוכלו לתאר אותה דרך סיפור של לקוח?', vc: 'האתר מדבר על פיצ׳רים, לא על בעיה. איזה כאב אתם פותרים, ואיך אתם יודעים שהוא אמיתי?' },
];

const WHY = {
  problem: 'המשקיע בודק אם הכאב אמיתי, דחוף ושווה כסף — או רק "נחמד שיהיה".',
  market: 'המשקיע בודק אם השוק מספיק גדול ואם יש לכם יתרון שקשה להעתיק.',
  model: 'המשקיע בודק אם יש מנוע כלכלי בריא: כמה עולה לקוח וכמה הוא מכניס.',
  traction: 'המשקיע מחפש ראיות שהשוק רוצה את המוצר — לא רק כוונות.',
  funds: 'המשקיע בודק שאתם יודעים בדיוק מה הכסף קונה ואיפה תהיו בסבב הבא.',
  risks: 'המשקיע בודק מודעות עצמית ויושרה — האם אתם מכירים את נקודות התורפה ומתכננים סביבן.',
};

export function generateQuestions(profile, persona = 'angel', length = 'short') {
  const per = LENGTHS[length]?.perCategory || 1;
  const c = ctx(profile);
  const seed = hash(profile.businessName + persona);
  const questions = [];
  const gapQs = (profile.gaps || [])
    .map((g) => GAP_QUESTIONS.find((q) => q.re.test(g)))
    .filter(Boolean);

  for (const key of CATEGORY_KEYS) {
    const bank = BANK[key][persona] || BANK[key].angel;
    const start = Math.abs(seed + key.length) % bank.length;
    const chosen = [];
    if (key === 'risks' && gapQs.length) chosen.push(gapQs[0][persona]);
    if (key === 'traction' && gapQs.find((q) => q.re.source.includes('משיכה')) && per > 1) {
      chosen.push(gapQs.find((q) => q.re.source.includes('משיכה'))[persona]);
    }
    for (let i = 0; chosen.length < per && i < bank.length; i++) {
      const q = fill(bank[(start + i) % bank.length], c);
      if (!chosen.includes(q)) chosen.push(q);
    }
    chosen.slice(0, per).forEach((q, i) => questions.push({ id: `${key}-${i + 1}`, category: key, question: q, why: WHY[key] }));
  }
  return { questions };
}

/* =========================== evaluate =========================== */
const DONT_KNOW = rx(['לא יודע', 'לא יודעת', 'אין לי מושג', 'אין לי תשובה', 'לא בטוח', 'לא בטוחה', 'עוד לא בדקנו', 'אין לנו נתונים', "i don't know", 'idk', 'not sure', 'no idea', 'דלג', 'skip']);
const HEDGE = rx(['אולי', 'נראה לי', 'אני חושב', 'אני חושבת', 'מקווה', 'בערך', 'כנראה', 'probably', 'maybe', 'i think', 'hopefully']);
const NUM = /\d|אחוז|מיליון|אלף|%/;

const RUBRIC = {
  problem: [
    { key: 'who', re: rx(['לקוח', 'עסק', 'משתמש', 'בעלי', 'מנהל', 'הורים', 'סטודנט', 'חברות', 'customer', 'user', 'business']), good: 'הגדרת למי בדיוק הבעיה כואבת', tip: 'הגדר במדויק מי סובל מהבעיה (פרסונה ספציפית)', guide: 'מי בדיוק הלקוח שהכי סובל מהבעיה? תאר אותו במשפט.' },
    { key: 'pain', re: NUM, good: 'כימתת את הכאב במספרים', tip: 'כמת את הכאב — כמה זמן/כסף הבעיה עולה ללקוח', guide: 'כמה שעות או שקלים הבעיה הזו עולה ללקוח בחודש?' },
    { key: 'alt', re: rx(['היום', 'כיום', 'במקום', 'אקסל', 'ידני', 'ידנית', 'מתחרים', 'currently', 'today', 'manual', 'instead']), good: 'הסברת איך מתמודדים עם הבעיה היום', tip: 'הסבר מה הלקוחות עושים היום ולמה זה לא מספיק', guide: 'איך הלקוח פותר את הבעיה היום, ומה רע בפתרון הזה?' },
    { key: 'benefit', re: rx(['חוסך', 'חוסכים', 'מקצר', 'מגדיל', 'מוריד', 'משפר', 'מאפשר', 'save', 'reduce', 'increase', 'faster']), good: 'חיברת את הפתרון לתועלת ברורה', tip: 'חבר את הפתרון לתוצאה מדידה ללקוח', guide: 'מה התוצאה המדידה שהלקוח מקבל אחרי שהוא משתמש בכם?' },
    { key: 'proof', re: rx(['למשל', 'לדוגמה', 'לדוגמא', 'פיילוט', 'ראיינו', 'שיחות', 'סקר', 'example', 'interview', 'pilot']), good: 'נתת דוגמה או ראיה מהשטח', tip: 'הוסף דוגמה אמיתית או ראיה (שיחות עם לקוחות, פיילוט)', guide: 'יש לקוח ספציפי שסיפר לך על הכאב הזה? מה הוא אמר?' },
  ],
  market: [
    { key: 'competitors', re: rx(['מתחר', 'חלופ', 'בניגוד', 'לעומת', 'competitor', 'alternative', 'unlike', 'vs']), good: 'שיימת מתחרים או חלופות', tip: 'שיים 2–3 מתחרים או חלופות אמיתיות', guide: 'מי 2–3 החלופות שהלקוח שוקל במקומכם?' },
    { key: 'moat', re: rx(['פטנט', 'טכנולוג', 'דאטה', 'נתונים', 'קהילה', 'אפקט רשת', 'שותפות', 'בלעדי', 'מותג', 'מומחיות', 'patent', 'data', 'network effect', 'exclusive']), good: 'הצגת יתרון תחרותי שקשה להעתיק', tip: 'הצג Moat אמיתי: דאטה, אפקט רשת, שותפות בלעדית, טכנולוגיה או עלות מעבר', guide: 'מה יש לכם שמתחרה עם הרבה כסף לא יכול לקנות מחר בבוקר?' },
    { key: 'size', re: rx(['שוק', 'tam', 'sam', 'som', 'מיליון', 'מיליארד', 'market', 'billion', 'million']), good: 'התייחסת לגודל השוק', tip: 'תן הערכת גודל שוק (TAM/SAM/SOM) ואיך חישבת', guide: 'כמה לקוחות פוטנציאליים יש, וכמה כל אחד משלם בשנה? (זה ה-SAM שלך)' },
    { key: 'num', re: NUM, good: 'השתמשת במספרים', tip: 'גבה את הטענות במספרים', guide: 'איזה מספר אחד הכי מוכיח שהשוק גדול מספיק?' },
    { key: 'why', re: rx(['לכן', 'בגלל', 'כי ', 'מאחר', 'because', 'therefore']), good: 'הסברת את ההיגיון מאחורי הבידול', tip: 'הסבר למה הבידול שלך חשוב ללקוח, לא רק מה הוא', guide: 'למה הלקוח בכלל אכפת לו מהבידול הזה?' },
  ],
  model: [
    { key: 'payer', re: rx(['משלם', 'משלמים', 'מנוי', 'עמלה', 'רישיון', 'חבילה', 'pay', 'subscription', 'commission', 'license']), good: 'הבהרת מי משלם ועל מה', tip: 'הבהר מי משלם, על מה ובאיזה מודל (מנוי/עמלה/רישיון)', guide: 'מי בדיוק מוציא את כרטיס האשראי, ועל מה?' },
    { key: 'price', re: /₪|\$|ש["״]?ח|שקל|דולר|€|לחודש|בחודש|לשנה/, good: 'נקבת במחיר קונקרטי', tip: 'נקוב במחיר מדויק (₪ לחודש / לעסקה)', guide: 'מה המחיר הממוצע שלקוח משלם בחודש או בשנה?' },
    { key: 'unit', re: rx(['cac', 'ltv', 'עלות גיוס', 'עלות רכישת', 'ערך לקוח', 'החזר', 'payback']), good: 'דיברת על CAC/LTV', tip: 'הצג CAC, LTV והיחס ביניהם (יעד: LTV ≥ 3×CAC)', guide: 'כמה עולה לך להביא לקוח אחד, וכמה הוא מכניס עד שהוא עוזב?' },
    { key: 'margin', re: rx(['מרג', 'רווח', 'שולי', 'גולמי', 'margin', 'profit', 'gross']), good: 'התייחסת לשולי רווח', tip: 'ציין שולי רווח גולמיים ואיך ישתפרו בסקייל', guide: 'מכל 100 ₪ שנכנסים — כמה נשארים אחרי עלות ישירה?' },
    { key: 'num', re: NUM, good: 'גיבית את המודל במספרים', tip: 'הוסף מספרים — גם אם הם הנחות, ציין שהן הנחות', guide: 'גם אם אין עדיין נתונים — מה ההנחה המספרית שלך?' },
  ],
  traction: [
    { key: 'customers', re: rx(['לקוחות', 'משתמשים', 'פיילוט', 'מנויים', 'הזמנות', 'customers', 'users', 'pilot', 'paying']), good: 'הצגת לקוחות או משתמשים קיימים', tip: 'ציין כמה לקוחות/משתמשים/פיילוטים יש לכם', guide: 'כמה לקוחות (גם לא משלמים) השתמשו במוצר עד היום?' },
    { key: 'num', re: NUM, good: 'נתת מספרים מדויקים', tip: 'תן מספרים מדויקים — לא "הרבה" או "המון"', guide: 'מה המספר הכי מרשים שיש לך כרגע — גם אם הוא קטן?' },
    { key: 'growth', re: rx(['צמיחה', 'גדלנו', 'בחודש', 'חודש על חודש', 'mom', 'growth', 'grew', 'שימור', 'נטישה', 'churn', 'retention']), good: 'הראית מגמה של צמיחה או שימור', tip: 'הראה מגמה: צמיחה חודשית, שימור או נטישה', guide: 'איך המספר הזה נראה לפני 3 חודשים לעומת היום?' },
    { key: 'revenue', re: rx(['הכנסות', 'הכנסה', 'mrr', 'arr', 'מכירות', 'revenue', 'sales', '₪', '\\$']), good: 'דיברת על הכנסות', tip: 'אם יש הכנסות — הציגו אותן (MRR/ARR). אם לא — הציגו כוונת רכישה (LOI)', guide: 'כמה כסף נכנס בחודש האחרון? ואם אפס — מי הבטיח לשלם?' },
    { key: 'learn', re: rx(['למדנו', 'פידבק', 'שינינו', 'גילינו', 'feedback', 'learned', 'iterat']), good: 'הראית למידה מהשטח', tip: 'שתף מה למדתם מהלקוחות ומה שיניתם בעקבות זה', guide: 'מה הדבר הכי מפתיע שלמדת מהלקוחות הראשונים?' },
  ],
  funds: [
    { key: 'amount', re: rx(['מגייסים', 'גיוס', 'סבב', 'מיליון', 'אלף', 'raise', 'round', 'seed', 'סיד']), good: 'ציינת סכום גיוס', tip: 'ציין במדויק כמה אתם מגייסים', guide: 'כמה כסף בדיוק אתם צריכים?' },
    { key: 'split', re: /%|אחוז|פיתוח|שיווק|מכירות|גיוס עובדים|R&D|marketing|hiring/i, good: 'פירקת את השימוש בכסף', tip: 'פרק את השימוש בכסף לפי אחוזים (פיתוח / שיווק / מכירות / תפעול)', guide: 'אם תחלק את הכסף ל-3 סלים — מה האחוז של כל סל?' },
    { key: 'milestone', re: rx(['יעד', 'אבן דרך', 'נגיע', 'עד סוף', 'חודשים', 'milestone', 'months', 'target']), good: 'הגדרת אבני דרך עם לוח זמנים', tip: 'הגדר 2–3 אבני דרך מדידות ל-12–18 חודשים', guide: 'מה 2 המספרים שתרצה להראות למשקיע בעוד 18 חודשים?' },
    { key: 'runway', re: rx(['ראנוויי', 'runway', 'מספיק ל', 'חודשי פעילות']), good: 'התייחסת לראנוויי', tip: 'ציין לכמה חודשים הכסף מספיק (Runway)', guide: 'לכמה חודשים הכסף הזה יספיק לכם?' },
    { key: 'why_now', re: rx(['עכשיו', 'כרגע', 'הזדמנות', 'חלון', 'now', 'window', 'timing']), good: 'הסברת למה עכשיו', tip: 'הסבר למה הכסף נחוץ דווקא עכשיו', guide: 'מה יקרה אם תגייסו רק בעוד שנה?' },
  ],
  risks: [
    { key: 'name', re: rx(['סיכון', 'אתגר', 'חשש', 'תלות', 'רגולציה', 'risk', 'challenge', 'dependency']), good: 'שיימת סיכון באופן ישיר', tip: 'שיים במפורש את הסיכון המרכזי — משקיעים מעריכים כנות', guide: 'מה הדבר האחד שאם ישתבש — יפיל את העסק?' },
    { key: 'mitigate', re: rx(['כדי', 'לכן', 'אנחנו מתמודדים', 'הפתרון', 'מפחיתים', 'בודקים', 'mitigat', 'plan', 'תוכנית']), good: 'הצגת תוכנית התמודדות', tip: 'הצג איך אתם מצמצמים את הסיכון בפועל', guide: 'מה אתם עושים כבר עכשיו כדי לצמצם את הסיכון הזה?' },
    { key: 'evidence', re: NUM, good: 'גיבית במספרים או עובדות', tip: 'גבה את התוכנית בעובדה או בנתון', guide: 'איזה נתון מראה שהסיכון בשליטה?' },
    { key: 'team', re: rx(['ניסיון', 'צוות', 'מייסד', 'שנים', 'experience', 'team', 'founder']), good: 'חיברת את הצוות ליכולת להתמודד', tip: 'הראה למה לצוות יש את הניסיון להתמודד עם הסיכון', guide: 'איזה ניסיון קודם של הצוות רלוונטי לסיכון הזה?' },
    { key: 'honest', re: rx(['עדיין לא', 'אנחנו יודעים', 'מודים', 'נקודת תורפה', 'חולשה', 'weakness', 'not yet']), good: 'הפגנת מודעות עצמית וכנות', tip: 'אל תפחד להודות בחולשה — ואז להציג תוכנית', guide: 'איפה אתם עדיין לא חזקים מספיק, ומה התוכנית?' },
  ],
};

function improvedAnswerFor(cat, p) {
  const c = ctx(p);
  const priceKnown = p.pricing && !/^לא מופיע|בלי מחירים/.test(p.pricing);
  const t = {
    problem: `"${c.audience} מבזבזים היום [X שעות / ₪] בחודש על [הבעיה המרכזית] — רובם עדיין עושים את זה [ידנית / באקסל / דרך ספקים יקרים]. ב-${c.name} הפתרון הוא ${c.product}, שמקצר את התהליך ל-[Y] ומחזיר להם [Z ₪] בחודש. לפני שבנינו, דיברנו עם [N] לקוחות פוטנציאליים — [80%] תיארו את זה כאחת משלוש הבעיות הכי כואבות שלהם. לדוגמה, [שם לקוח] אמר לנו: '...'."`,
    market: `"הלקוחות שלנו משווים אותנו היום ל-[מתחרה א] ול-[חלופה ידנית]. [מתחרה א] בנוי עבור [ארגונים גדולים / שוק אחר], ואנחנו מתמקדים ב-${c.audience}. היתרון שקשה להעתיק: [דאטה ייחודי שמצטבר מכל לקוח / שותפות בלעדית עם ... / אינטגרציה עמוקה עם ...] — כל לקוח חדש משפר את המוצר לכולם. השוק הרלוונטי (SAM): [כמות לקוחות] × [מחיר שנתי] = [₪ X מיליון], ואנחנו מכוונים ל-[Y%] ממנו תוך 3 שנים."`,
    model: `"המודל העסקי של ${c.name}: ${p.businessModel && !p.businessModel.startsWith('לא') ? p.businessModel : '[מודל ההכנסה — מנוי / עמלה / רישיון]'}. ${priceKnown ? `המחירים היום: ${trimTo(p.pricing.replace(/^מחיר(ים|ון)?:\s*/, '').replace(/\.$/, ''), 90)}` : 'המחיר הממוצע הוא [₪ X לחודש]'}. ה-CAC שלנו היום הוא [₪ Y] — בעיקר דרך [ערוץ], וה-LTV עומד על [₪ Z] (כ-[N] חודשי שימוש בממוצע), כלומר יחס של [3:1]. שולי הרווח הגולמיים [70%] ויעלו ל-[80%] בסקייל בזכות [אוטומציה / הנחות ספקים]."`,
    traction: `"יש לנו [N] לקוחות משלמים ו-[M] בפיילוט, עם MRR של [₪ X] וצמיחה של [Y%] חודש על חודש ב-[6] החודשים האחרונים. הנטישה החודשית [Z%], ו-[NPS / % חידושים] מראה שהלקוחות מקבלים ערך. [לקוח מוכר] התחיל בפיילוט והפך ללקוח משלם תוך [שבועות]. הלמידה הכי חשובה: [תובנה] — ולכן שינינו את [פיצ׳ר / תמחור]."`,
    funds: `"אנחנו מגייסים [₪/$ X] שיספיקו ל-[18] חודשי פעילות. [40%] לפיתוח מוצר ([פיצ׳ר מפתח]), [35%] לשיווק ומכירות ב-${c.audience}, [25%] לתפעול וגיוס [N] עובדים. היעדים: [N לקוחות משלמים], [MRR של ₪ Y] ו-[כניסה לשוק / שותפות] — בדיוק המדדים שיאפשרו סבב [A] בהערכת שווי גבוהה יותר. למה עכשיו: [חלון הזדמנויות בשוק / ביקוש שלא מצליחים לספק]."`,
    risks: `"הסיכון הכי גדול שלנו הוא [למשל: עלות גיוס לקוח גבוהה מהצפוי / תלות בספק / רגולציה]. אנחנו מודעים לזה ולכן כבר [פעולה קונקרטית — בודקים 3 ערוצי שיווק במקביל / חתמנו על ספק חלופי]. הנתונים עד היום מראים [נתון], ובצוות יש [שם] עם [X שנות ניסיון ב...] שכבר התמודד עם זה ב-[חברה קודמת]."`,
  };
  return t[cat];
}

const FOLLOW = {
  problem: { angel: 'יפה. ומה יקרה ללקוח אם הוא ימשיך לחיות עם הבעיה הזו עוד שנה?', vc: 'אוקיי, אבל אם זה כל כך כואב — למה הלקוחות לא פתרו את זה כבר? מה עצר אותם?' },
  market: { angel: 'ואיך תמשיכו לשמור על היתרון הזה גם כשיהיו יותר מתחרים?', vc: 'נניח שהמתחר הגדול מוריד מחיר ב-50% מחר. מה אתם עושים?' },
  model: { angel: 'ואיך המחיר הזה ישתנה כשתגדלו?', vc: 'ומה קורה ליחס LTV/CAC כשתמצו את ערוצי השיווק הזולים?' },
  traction: { angel: 'מה הלקוחות הכי אוהבים במוצר?', vc: 'כמה מהלקוחות האלה הגיעו מקשרים אישיים שלכם, וכמה מערוץ שאפשר לשכפל?' },
  funds: { angel: 'ומה תעשו אם תגייסו רק חצי מהסכום?', vc: 'אם לא תגיעו ליעדים האלה ב-18 חודשים — מה תוכנית ב׳?' },
  risks: { angel: 'יש עוד סיכון שאתם רואים באופק?', vc: 'ומה הסיבה הכי סבירה שבגללה העסק הזה ייכשל בעוד שנתיים?' },
};

export function evaluateAnswer({ profile, question, category, answer, persona = 'angel', isFollowUp = false }) {
  const a = String(answer || '').trim();
  const words = a.split(/\s+/).filter(Boolean).length;
  const rubric = RUBRIC[category] || RUBRIC.problem;
  const dontKnow = words < 5 || (DONT_KNOW.test(a) && words < 25);
  const hits = rubric.filter((r) => r.re.test(a));
  const misses = rubric.filter((r) => !r.re.test(a));
  const hasNum = NUM.test(a);
  const hedges = count(a, HEDGE);

  let score;
  if (dontKnow) score = words < 3 ? 1 : 2;
  else {
    score = 2.5 + hits.length * 1.25 + (hasNum ? 0.8 : 0) + (words >= 35 ? 0.8 : 0) + (words >= 70 ? 0.5 : 0);
    if (hedges >= 2) score -= 0.7;
    if (persona === 'vc') {
      if (!hasNum) score -= 1;
      if (words > 230) score -= 0.5;
      score -= 0.3;
    }
    if (words < 15) score = Math.min(score, 4);
  }
  score = Math.max(1, Math.min(10, Math.round(score)));

  const strengths = dontKnow ? [] : hits.map((h) => h.good);
  if (!dontKnow && words >= 35 && words <= 180) strengths.push('אורך התשובה מאוזן — מספיק פירוט בלי להתפזר');
  if (!dontKnow && strengths.length === 0) strengths.push('ניסית לענות ישירות על השאלה — זו נקודת פתיחה טובה');

  const improvements = misses.slice(0, 3).map((m) => m.tip);
  if (hedges >= 2) improvements.push('הפחת ביטויי היסוס ("אולי", "נראה לי") — דבר בביטחון ותציין הנחות במפורש');
  if (persona === 'vc' && words > 230) improvements.push('קצר — משקיע קשוח מצפה לתשובה של 30–60 שניות');

  const numMatch = a.match(/\d[\d,.]*\s?(%|אחוז|₪|\$|לקוחות|משתמשים|עסקים|אלף|מיליון|חודשים|שעות|דקות|ימים)?/);
  const followUp = numMatch && !dontKnow
    ? persona === 'vc'
      ? `ציינת "${numMatch[0].trim()}". מאיפה המספר הזה מגיע, ואיך הוא ייראה בעוד 12 חודשים?`
      : `הזכרת "${numMatch[0].trim()}" — תוכל להרחיב איך הגעתם לזה?`
    : misses[0]
      ? (persona === 'vc' ? 'בוא נחדד: ' : 'שאלה קטנה להמשך: ') + misses[0].guide
      : FOLLOW[category][persona];

  const whyWeak = [];
  if (dontKnow) whyWeak.push('תשובה של "לא יודע" או תשובה קצרה מדי משדרת למשקיע שלא חשבתם על הנושא — גם אם חשבתם.');
  else {
    if (misses.length >= 3) whyWeak.push(`חסרים כמה רכיבים שמשקיע מצפה לשמוע בשאלה מסוג "${categoryByKey[category]?.label}".`);
    if (!hasNum) whyWeak.push('אין מספרים — בלי מספרים, הטענות נשמעות כמו תקווה ולא כמו עובדות.');
    if (words < 15) whyWeak.push('התשובה קצרה מדי כדי לשכנע.');
    if (hedges >= 2) whyWeak.push('יש הרבה מילות היסוס, וזה פוגע באמינות.');
  }
  if (!whyWeak.length) whyWeak.push('התשובה נכונה בכיוון, אבל עוד לא מספיק ממוקדת ומגובה כדי לשכנע.');

  return {
    score,
    label: labelForScore(score).key,
    strengths: strengths.slice(0, 4),
    improvements: improvements.slice(0, 4),
    improvedAnswer: improvedAnswerFor(category, profile),
    followUp: isFollowUp ? FOLLOW[category][persona] : followUp,
    coach: {
      whyWeak,
      guidingQuestions: (misses.length ? misses : rubric).slice(0, 3).map((m) => m.guide),
      encouragement: dontKnow
        ? 'זה לגמרי בסדר להיתקע — בדיוק בשביל זה מתרגלים. בוא נבנה את התשובה יחד, צעד אחר צעד.'
        : 'יש פה בסיס טוב. עם שני-שלושה חידודים, התשובה הזו תישמע הרבה יותר משכנעת.',
    },
  };
}

/* =========================== hints =========================== */
const HINTS = {
  problem: {
    intent: 'המשקיע רוצה לדעת אם הבעיה אמיתית ודחופה מספיק כדי שאנשים ישלמו על פתרון. הוא מחפש לקוח ברור, כאב מדיד, וסיבה למה הפתרונות הקיימים לא מספיקים.',
    skeleton: ['מי סובל? → תאר את הלקוח הספציפי (לא "כולם")', 'כמה זה כואב? → כמת בזמן / כסף / סיכון, ומה עושים היום במקום', 'איך אתם פותרים? → התועלת המדידה + דוגמה אמיתית של לקוח'],
    opener: (c) => `${c.audience} מאבדים היום בממוצע ___ בחודש בגלל ___, ו-${c.name} פותר את זה בכך ש___...`,
  },
  market: {
    intent: 'המשקיע בודק אם יש מקום לעסק גדול, ומה ימנע ממתחרים חזקים לדרוס אתכם. הוא מחפש מודעות למתחרים ויתרון שמתחזק עם הזמן.',
    skeleton: ['מי החלופות? → 2–3 מתחרים או "החלופה הידנית"', 'מה ה-Moat? → משהו שמצטבר ומתחזק: דאטה, רשת, שותפות, עלות מעבר', 'כמה גדול השוק? → חישוב פשוט: מספר לקוחות × מחיר שנתי'],
    opener: (c) => `בניגוד ל___ שמתמקדים ב___, ${c.name} בנוי במיוחד עבור ${c.audience}, והיתרון שקשה להעתיק הוא ___...`,
  },
  model: {
    intent: 'המשקיע רוצה לראות שכל לקוח חדש מרוויח לכם כסף, ושיש היגיון מספרי שאפשר להגדיל. גם הנחות מנומקות עדיפות על "עוד לא חישבנו".',
    skeleton: ['מי משלם ועל מה? → מודל + מחיר מדויק', 'כמה עולה לקוח ומה הוא שווה? → CAC מול LTV (יעד 1:3 ומעלה)', 'איך זה משתפר בסקייל? → שולי רווח היום ומחר'],
    opener: (c) => `${c.name} גובה ___ ₪ ל___, עלות הבאת לקוח היא כ-___ ₪, ולקוח ממוצע נשאר ___ חודשים — כלומר...`,
  },
  traction: {
    intent: 'המשקיע מחפש ראיות שהשוק רוצה את המוצר: לקוחות, שימוש, הכנסות או לפחות התחייבויות. מספר קטן אבל אמיתי עדיף על הבטחות גדולות.',
    skeleton: ['המספר החזק ביותר → לקוחות / משתמשים / הכנסות / פיילוטים', 'המגמה → איך זה השתנה בחודשים האחרונים', 'הסיפור → לקוח אחד שממחיש את הערך + מה למדתם'],
    opener: (c) => `תוך ___ חודשים הגענו ל-___ לקוחות, עם צמיחה של ___% בחודש, ולקוח כמו ___ אמר ש-${c.name}...`,
  },
  funds: {
    intent: 'המשקיע רוצה להבין מה ההשקעה קונה: לאן תגיעו, מתי, ולמה בלי הכסף זה לא יקרה. הוא מחפש תוכנית ממוקדת שמובילה לסבב הבא.',
    skeleton: ['כמה ולכמה זמן? → סכום + ראנוויי בחודשים', 'על מה? → 3 סלים באחוזים', 'מה יושג? → 2–3 אבני דרך מדידות שמצדיקות את הסבב הבא'],
    opener: (c) => `אנחנו מגייסים ___ שיספיקו ל-___ חודשים, כדי להביא את ${c.name} ל-___ לקוחות משלמים ו-___ הכנסה חודשית...`,
  },
  risks: {
    intent: 'המשקיע בודק אם אתם מכירים את נקודות התורפה ולא מתכחשים להן. תשובה כנה עם תוכנית התמודדות מעוררת הרבה יותר אמון מ"אין לנו סיכונים".',
    skeleton: ['שיים את הסיכון → במשפט אחד וכן', 'מה עושים לגביו? → פעולה שכבר מתבצעת', 'למה תצליחו? → נתון או ניסיון של הצוות שמחזק את זה'],
    opener: (c) => `הסיכון הכי משמעותי שאנחנו רואים ב-${c.name} הוא ___, ולכן כבר היום אנחנו ___...`,
  },
};

export function generateHints({ profile, category, question, persona = 'angel' }) {
  const c = ctx(profile);
  const h = HINTS[category] || HINTS.problem;
  const extra = persona === 'vc' ? ' משקיע קשוח ירצה לשמוע מספרים כבר במשפט הראשון.' : '';
  return { intent: h.intent + extra, skeleton: h.skeleton, opener: h.opener(c) };
}

/* =========================== summary =========================== */
const GAP_TO_ACTION = [
  { re: /הבעיה/, action: 'הוסיפו לראש דף הבית משפט "בעיה" חד: למי כואב, כמה זה עולה להם, ולמה הפתרונות הקיימים לא עובדים.' },
  { re: /נתוני משיכה/, action: 'הוסיפו "פס מספרים" באתר: מספר לקוחות, שעות/כסף שנחסכו, צמיחה — גם מספרים קטנים ואמיתיים עובדים.' },
  { re: /תמחור|מרוויח/, action: 'הוסיפו דף תמחור (או לפחות "החל מ-X ₪") — זה מראה למשקיע מודל עסקי ברור.' },
  { re: /בידול/, action: 'הוסיפו סקשן "למה אנחנו" / טבלת השוואה מול חלופות, עם היתרון שקשה להעתיק.' },
  { re: /הוכחה חברתית/, action: 'הוסיפו 2–3 המלצות לקוחות עם שם, תפקיד ותמונה, ולוגואים של לקוחות/שותפים.' },
  { re: /הצוות/, action: 'הוסיפו דף "הצוות" עם המייסדים, ניסיון רלוונטי וקישור ללינקדאין.' },
  { re: /קריאה ברורה/, action: 'הוסיפו כפתור פעולה בולט (התחילו בחינם / תאמו הדגמה) מעל לקו הגלילה.' },
  { re: /מעט תוכן/, action: 'הרחיבו את תיאור המוצר: איך זה עובד ב-3 צעדים, צילומי מסך ומקרה שימוש אחד מלא.' },
];

const CATEGORY_MEETING_ACTION = {
  problem: 'הכינו "סיפור לקוח" של 30 שניות שממחיש את הכאב במספרים.',
  market: 'הכינו שקף מתחרים (2×2) ומשפט Moat אחד שאתם יודעים לומר בעל-פה.',
  model: 'הכינו גיליון Unit Economics פשוט: מחיר, CAC, LTV, שולי רווח — גם אם הם הנחות.',
  traction: 'רכזו את 3 המספרים החזקים ביותר שלכם וגרף צמיחה אחד.',
  funds: 'הכינו פירוק שימוש בכסף באחוזים + 3 אבני דרך ל-18 חודשים.',
  risks: 'כתבו את 3 הסיכונים המרכזיים ולכל אחד פעולה שכבר מתבצעת לצמצומו.',
};

export function computeStats(items = []) {
  const byCat = {};
  for (const c of CATEGORIES) byCat[c.key] = { scores: [], hints: 0 };
  for (const it of items) {
    const best = Math.max(0, ...(it.attempts || []).map((a) => a.evaluation?.score || 0));
    if (best > 0 && byCat[it.category]) {
      byCat[it.category].scores.push(best);
      byCat[it.category].hints += it.hintLevel || 0;
    }
  }
  const categoryScores = CATEGORIES.map((c) => {
    const s = byCat[c.key].scores;
    return { key: c.key, label: c.label, score: s.length ? Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10 : null, answered: s.length };
  });
  const answered = categoryScores.filter((c) => c.score != null);
  const avg = answered.length ? answered.reduce((a, c) => a + c.score, 0) / answered.length : 0;
  const totalHints = items.reduce((n, it) => n + (it.hintLevel || 0), 0);
  const coverage = answered.length / CATEGORIES.length;
  // Readiness rewards both quality and coverage of all 6 investor categories; hints cost a little
  const readiness = Math.max(0, Math.min(100, Math.round(avg * 10 * (0.5 + 0.5 * coverage) - totalHints * 1.2)));
  return { categoryScores, readiness, answeredCount: items.filter((i) => i.attempts?.length).length, totalHints };
}

export function summarizeSession({ profile, items = [], persona = 'angel' }) {
  const stats = computeStats(items);
  const answered = items.filter((i) => i.attempts?.length);
  const ranked = answered
    .map((i) => {
      const best = i.attempts.reduce((b, a) => ((a.evaluation?.score || 0) > (b.evaluation?.score || 0) ? a : b), i.attempts[0]);
      return { ...i, best };
    })
    .sort((a, b) => (a.best.evaluation.score - a.hintLevel * 0.5) - (b.best.evaluation.score - b.hintLevel * 0.5));

  const ordered = [...ranked.filter((i) => i.best.evaluation.score < 8), ...ranked.filter((i) => i.best.evaluation.score >= 8 && i.hintLevel > 0)];
  const seenCats = new Set();
  const distinct = ordered.filter((i) => !seenCats.has(i.category) && seenCats.add(i.category));
  const weakSpots = distinct.slice(0, 3).map((i) => ({
    question: i.question,
    category: i.category,
    score: i.best.evaluation.score,
    issue: [
      i.best.evaluation.score < WEAK_THRESHOLD ? `ציון ${i.best.evaluation.score}/10` : null,
      i.hintLevel ? `נעזרת ב-${i.hintLevel} רמות רמזים` : null,
      i.best.evaluation.improvements?.[0],
    ].filter(Boolean).join(' · '),
    preparedAnswer: i.best.evaluation.improvedAnswer,
  }));
  // Also include unanswered categories as weak spots if we have room
  for (const cs of stats.categoryScores) {
    if (weakSpots.length >= 3) break;
    if (cs.score == null) {
      weakSpots.push({ question: `(לא נענתה) ${categoryByKey[cs.key].focus}`, category: cs.key, score: null, issue: 'הקטגוריה לא תורגלה בסשן', preparedAnswer: improvedAnswerFor(cs.key, profile) });
    }
  }

  const topCats = stats.categoryScores.filter((c) => c.score >= 7).sort((a, b) => b.score - a.score);
  const businessStrengths = uniq([
    ...topCats.slice(0, 2).map((c) => `תשובות חזקות בתחום "${c.label}" (${c.score}/10)`),
    ...(profile.strengths || []),
  ]).slice(0, 3);

  const websiteActions = uniq((profile.gaps || []).map((g) => GAP_TO_ACTION.find((x) => x.re.test(g))?.action)).slice(0, 6);
  if (!websiteActions.length) websiteActions.push('האתר מכסה את היסודות — שקלו להוסיף דף "למשקיעים" עם סיכום של שקף אחד.');

  const weakCats = stats.categoryScores.filter((c) => c.score == null || c.score < 7).sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
  const meetingActions = uniq([
    ...weakCats.slice(0, 4).map((c) => CATEGORY_MEETING_ACTION[c.key]),
    stats.totalHints > 2 ? 'תרגלו שוב את השאלות שבהן נעזרתם ברמזים — בקול רם, עם טיימר של 60 שניות.' : null,
    persona === 'angel' ? 'אחרי שתרגישו בנוח — עברו לתרגול מול "משקיע קשוח".' : 'תרגלו תשובה של משפט אחד לכל שאלה, ואז הרחבה רק אם מבקשים.',
  ]).slice(0, 5);

  const r = stats.readiness;
  const verdict =
    r >= 80 ? 'מוכנים לפגישה! התשובות חדות ומגובות. נשאר ללטש את הפרטים הקטנים.'
    : r >= 60 ? 'בכיוון הנכון. יש בסיס טוב, אבל כמה תחומים דורשים מספרים והוכחות לפני פגישה אמיתית.'
    : r >= 40 ? 'יש עבודה לפני הפגישה. כדאי לחזק את התחומים החלשים ולתרגל שוב.'
    : 'עדיין לא מוכנים לפגישת משקיעים. התחילו מהתשובות המוכנות למטה ותרגלו שוב.';

  return { ...stats, verdict, businessStrengths, weakSpots, websiteActions, meetingActions };
}
