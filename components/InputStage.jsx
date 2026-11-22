'use client';
import { useState } from 'react';
import { Spinner, api } from './ui';

const SAMPLE = `TaskFlow — מערכת ניהול משימות חכמה לעסקים קטנים
בעלי עסקים קטנים מבזבזים בממוצע 6 שעות בשבוע על תיאום משימות בוואטסאפ ובאקסל.
TaskFlow מרכזת את כל המשימות, התזכורות והלקוחות במקום אחד, עם אוטומציות מבוססות AI שחוסכות זמן.
מחירים: חבילת בסיס 49 ₪ לחודש, חבילת צוות 149 ₪ לחודש. נסו בחינם ל-14 יום.
כבר 320 עסקים משתמשים ב-TaskFlow. "חסכנו 5 שעות בשבוע" — דנה, בעלת סטודיו לעיצוב.
צרו קשר לתיאום הדגמה.`;

export default function InputStage({ onAnalyzed, aiEnabled, demo, setDemo }) {
  const [tab, setTab] = useState('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body = tab === 'url' ? { url, demo } : { text, demo };
      const data = await api('/api/analyze', body);
      onAnalyzed(data);
    } catch (err) {
      setError({ message: err.message, suggestPaste: err.suggestPaste });
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = tab === 'url' ? url.trim().length > 3 : text.trim().length >= 40;

  return (
    <div className="mx-auto max-w-3xl animate-fadeIn">
      <section className="mb-8 text-center">
        <p className="mb-3 inline-block rounded-full bg-investor-100 px-3 py-1 text-xs font-semibold text-investor-700 dark:bg-investor-900/50 dark:text-investor-100">
          Investor Pitch Simulator
        </p>
        <h1 className="mb-3 text-3xl font-extrabold leading-tight sm:text-4xl">
          תתאמנו על פגישת המשקיעים <span className="bg-gradient-to-l from-investor-600 to-coach-600 bg-clip-text text-transparent">לפני שהיא קורית</span>
        </h1>
        <p className="mx-auto max-w-xl text-slate-600 dark:text-slate-400">
          מזינים את האתר של העסק, ומקבלים שאלות של משקיע שמותאמות לעסק שלכם, מאמן שעוזר כשנתקעים, ציון לכל תשובה ודוח מוכנות מסכם.
        </p>
      </section>

      <form onSubmit={submit} className="card p-5 sm:p-6">
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist">
          {[
            ['url', '🌐 כתובת אתר'],
            ['text', '📋 הדבקת טקסט / תיאור'],
          ].map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => { setTab(k); setError(null); }}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === k ? 'bg-white shadow-sm dark:bg-slate-950' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'url' ? (
          <div>
            <label htmlFor="url" className="mb-2 block text-sm font-semibold">כתובת האתר של העסק</label>
            <input id="url" dir="ltr" className="input text-left" placeholder="https://www.your-business.co.il" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus inputMode="url" />
            <p className="mt-2 text-xs text-slate-500">נשלוף את דף הבית ועד 4 דפים מרכזיים (אודות, מחירים, שירותים, לקוחות).</p>
          </div>
        ) : (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="text" className="text-sm font-semibold">תוכן האתר או תיאור העסק</label>
              <button type="button" className="text-xs font-semibold text-investor-600 hover:underline dark:text-investor-100" onClick={() => setText(SAMPLE)}>
                מלא דוגמה
              </button>
            </div>
            <textarea id="text" className="input min-h-[200px] resize-y leading-relaxed" placeholder="הדביקו כאן את הטקסט מדף הנחיתה, טיוטת האתר או תיאור חופשי: מה העסק עושה, למי, מחירים, לקוחות, צוות..." value={text} onChange={(e) => setText(e.target.value)} />
            <p className="mt-2 text-xs text-slate-500">מתאים לדפי נחיתה מקומיים, טיוטות ואתרים שדורשים התחברות. {text.trim().length < 40 && `(לפחות 40 תווים — כרגע ${text.trim().length})`}</p>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200" role="alert">
            <p className="font-semibold">{error.message}</p>
            {error.suggestPaste && (
              <p className="mt-1">
                אין בעיה — אפשר להעתיק את הטקסט מהאתר ולהדביק אותו.{' '}
                <button type="button" className="font-bold underline" onClick={() => { setTab('text'); setError(null); }}>
                  עברו להדבקת טקסט ←
                </button>
              </p>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-xs text-slate-500">
            {aiEnabled ? (
              <>
                <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} className="accent-investor-600" />
                השתמש במצב דמו (מנוע מקומי, בלי Claude)
              </>
            ) : (
              <span>🧪 לא הוגדר <code className="ltr">ANTHROPIC_API_KEY</code> — האפליקציה רצה במצב דמו חכם.</span>
            )}
          </label>
          <button type="submit" className="btn-primary px-6 py-3 text-base" disabled={!canSubmit || loading}>
            {loading ? (<><Spinner /> {tab === 'url' ? 'שולף ומנתח את האתר…' : 'מנתח…'}</>) : 'נתחו את העסק ←'}
          </button>
        </div>
      </form>

      <div className="mt-8 grid gap-3 text-sm sm:grid-cols-3">
        {[
          ['🧑‍💼', 'משקיע מותאם', 'אנג׳ל ידידותי או VC קשוח — שאלות על העסק שלכם, לא גנריות.'],
          ['🧭', 'מאמן כשנתקעים', '3 רמות רמזים, הסבר מה המשקיע בודק, ודוגמה לתשובה משופרת.'],
          ['📊', 'דוח מוכנות', 'ציון לפי קטגוריות, תשובות לשינון ורשימת שיפורים לאתר.'],
        ].map(([i, t, d]) => (
          <div key={t} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="mb-1 text-xl">{i}</div>
            <div className="font-bold">{t}</div>
            <div className="text-slate-500 dark:text-slate-400">{d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
