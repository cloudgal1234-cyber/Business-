export const CATEGORIES = [
  { key: 'problem', label: 'בעיה ופתרון', en: 'Problem & Solution', icon: '🎯', focus: 'עד כמה הכאב אמיתי ודחוף?' },
  { key: 'market', label: 'שוק ומתחרים', en: 'Market & Competition', icon: '🏰', focus: 'מה היתרון התחרותי ולמה שלא יעתיקו אתכם מחר?' },
  { key: 'model', label: 'מודל עסקי ויחידות כלכליות', en: 'Business Model & Unit Economics', icon: '💰', focus: 'איך מרוויחים כסף, תמחור, שולי רווח, CAC/LTV?' },
  { key: 'traction', label: 'משיכה והוכחות בשטח', en: 'Traction & Validation', icon: '📈', focus: 'מה כבר הוכחתם — נתונים, לקוחות, פיילוטים?' },
  { key: 'funds', label: 'שימוש בכסף ויעדים', en: 'Use of Funds & Milestones', icon: '🗺️', focus: 'למה צריך את ההשקעה עכשיו ומה יקרה ב-12–18 החודשים הבאים?' },
  { key: 'risks', label: 'סיכונים ונקודות תורפה', en: 'Risks & Red Flags', icon: '⚠️', focus: 'שאלות מאתגרות על פערים והנחות יסוד.' },
];

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
export const categoryByKey = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

export const PERSONAS = {
  angel: {
    key: 'angel',
    name: 'משקיע אנג׳ל ידידותי',
    avatar: '😊',
    description: 'שאלות בונות ומכוונות, סבלני ומעודד. מתאים לתרגול ראשון.',
  },
  vc: {
    key: 'vc',
    name: 'קרן הון סיכון / משקיע קשוח',
    avatar: '🦈',
    description: 'שאלות חדות ומחטטות. דורש מספרים, הוכחות ותשובות קצרות וממוקדות.',
  },
};

export const LENGTHS = {
  short: { key: 'short', label: 'סשן קצר', perCategory: 1, description: '6 שאלות · כ-10 דקות' },
  full: { key: 'full', label: 'סשן מלא', perCategory: 2, description: '12 שאלות · כ-25 דקות' },
};

export const WEAK_THRESHOLD = 6;

export function labelForScore(score) {
  if (score >= 8) return { key: 'strong', text: 'חזק', tone: 'good' };
  if (score >= WEAK_THRESHOLD) return { key: 'good', text: 'טוב אבל חסר פירוט', tone: 'mid' };
  return { key: 'weak', text: 'דורש חיזוק', tone: 'bad' };
}
