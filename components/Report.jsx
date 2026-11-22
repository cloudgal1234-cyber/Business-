'use client';
import { useState } from 'react';
import { PERSONAS, categoryByKey } from '@/lib/constants';
import { List, ModeBadge, scoreTone } from './ui';

function Gauge({ value }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = value >= 75 ? '#10b981' : value >= 50 ? '#f59e0b' : '#f43f5e';
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-slate-200 dark:stroke-slate-800" />
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" strokeLinecap="round" stroke={color} strokeDasharray={c} strokeDashoffset={c - (c * value) / 100} style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-extrabold">{value}</span>
        <span className="text-xs text-slate-500">מתוך 100</span>
      </div>
    </div>
  );
}

export function reportToMarkdown({ report, profile, persona }) {
  const lines = [
    `# דוח מוכנות לפגישת משקיעים — ${profile.businessName}`,
    `תאריך: ${new Date().toLocaleDateString('he-IL')} · משקיע: ${PERSONAS[persona]?.name}`,
    '',
    `## ציון מוכנות כללי: ${report.readiness}/100`,
    report.verdict,
    '',
    '## ציון לפי קטגוריות',
    ...report.categoryScores.map((c) => `- ${categoryByKey[c.key].icon} ${c.label}: ${c.score != null ? `${c.score}/10` : 'לא תורגל'}`),
    '',
    '## 3 החוזקות הבולטות',
    ...report.businessStrengths.map((s) => `- ${s}`),
    '',
    '## נקודות לחיזוק — עם תשובות מוכנות לשינון',
    ...report.weakSpots.flatMap((w, i) => [
      `### ${i + 1}. ${w.question}`,
      `קטגוריה: ${categoryByKey[w.category]?.label || w.category}${w.score ? ` · ציון: ${w.score}/10` : ''}`,
      w.issue ? `מה חסר: ${w.issue}` : '',
      `**תשובה מוכנה:** ${w.preparedAnswer}`,
      '',
    ]),
    '## שיפורים מומלצים באתר',
    ...report.websiteActions.map((s) => `- [ ] ${s}`),
    '',
    '## הכנה לפגישה',
    ...report.meetingActions.map((s) => `- [ ] ${s}`),
    '',
    '---',
    'הופק ע״י Investor Pitch Simulator',
  ];
  return lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
}

export default function Report({ report, profile, persona, mode, items, onRestart, onPracticeWeak, onBackToSim }) {
  const [copied, setCopied] = useState(null);

  async function copy(text, key) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  }

  function download() {
    const md = reportToMarkdown({ report, profile, persona });
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pitch-readiness-${(profile.businessName || 'report').replace(/[^\w֐-׿-]+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const hintsUsed = items.reduce((n, i) => n + (i.hintLevel || 0), 0);

  return (
    <div className="mx-auto max-w-4xl animate-fadeIn space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold">דוח מוכנות לפגישה</h2>
          <p className="text-sm text-slate-500">{profile.businessName} · מול {PERSONAS[persona]?.name}</p>
        </div>
        <ModeBadge mode={mode} />
      </div>

      <div className="card flex flex-col items-center gap-6 p-6 sm:flex-row">
        <Gauge value={report.readiness} />
        <div className="flex-1 text-center sm:text-right">
          <div className="section-title">ציון מוכנות כללי</div>
          <p className="text-lg font-semibold leading-relaxed">{report.verdict}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs sm:justify-start">
            <span className="chip bg-slate-100 dark:bg-slate-800">✍️ {report.answeredCount} שאלות נענו</span>
            <span className="chip bg-slate-100 dark:bg-slate-800">🆘 {hintsUsed} רמזים</span>
            <span className="chip bg-slate-100 dark:bg-slate-800">↩︎ {items.filter((i) => i.isFollowUp).length} שאלות המשך</span>
          </div>
        </div>
      </div>

      <div className="card p-5 sm:p-6">
        <div className="section-title">חלוקה לפי קטגוריות</div>
        <div className="space-y-3">
          {report.categoryScores.map((c) => (
            <div key={c.key} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[220px_1fr_auto]">
              <span className="text-sm font-semibold">{categoryByKey[c.key].icon} {c.label}</span>
              <div className="col-span-2 row-start-2 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 sm:col-span-1 sm:row-start-auto">
                <div className={`h-full rounded-full ${c.score == null ? '' : c.score >= 8 ? 'bg-emerald-500' : c.score >= 6 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${(c.score || 0) * 10}%` }} />
              </div>
              <span className={`text-sm font-bold sm:order-none ${scoreTone(c.score)}`}>{c.score != null ? `${c.score}/10` : 'לא תורגל'}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="card p-5">
          <div className="section-title">💪 3 החוזקות הבולטות</div>
          <List items={report.businessStrengths} icon="✅" />
        </div>
        <div className="card p-5">
          <div className="section-title">🌐 שיפורים מומלצים באתר</div>
          <List items={report.websiteActions} icon="☐" />
        </div>
      </div>

      <div className="card border-coach-500/30 p-5 sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-coach-600">🧭</span>
          <div className="text-lg font-extrabold">נקודות לחיזוק — תשובות מוכנות לשינון ולליטוש</div>
        </div>
        <p className="mb-4 text-sm text-slate-500">השאלות שבהן הציון היה נמוך או שנעזרת ברמזים. התאימו את הנתונים בסוגריים המרובעים למספרים האמיתיים שלכם.</p>
        <div className="space-y-4">
          {report.weakSpots.map((w, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="chip bg-investor-100 text-investor-700 dark:bg-investor-900/60 dark:text-investor-100">{categoryByKey[w.category]?.icon} {categoryByKey[w.category]?.label}</span>
                {w.score ? <span className={`font-bold ${scoreTone(w.score)}`}>{w.score}/10</span> : null}
              </div>
              <p className="mb-1 font-bold">{w.question}</p>
              {w.issue && <p className="mb-3 text-sm text-slate-500">{w.issue}</p>}
              <div className="rounded-lg bg-coach-50 p-3 leading-relaxed dark:bg-coach-900/20">{w.preparedAnswer}</div>
              <button type="button" className="mt-2 text-xs font-semibold text-coach-700 hover:underline dark:text-coach-100 no-print" onClick={() => copy(w.preparedAnswer, `w${i}`)}>
                {copied === `w${i}` ? '✓ הועתק' : '📋 העתק תשובה'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <div className="section-title">🗓️ הכנה לפגישה</div>
        <List items={report.meetingActions} icon="☐" />
      </div>

      <div className="no-print flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button type="button" className="btn-primary" onClick={() => copy(reportToMarkdown({ report, profile, persona }), 'all')}>
          {copied === 'all' ? '✓ הסיכום הועתק' : '📋 העתק סיכום'}
        </button>
        <button type="button" className="btn-ghost" onClick={download}>⬇️ ייצוא Markdown</button>
        <button type="button" className="btn-ghost" onClick={() => window.print()}>🖨️ הדפסה / PDF</button>
        <span className="hidden flex-1 sm:block" />
        <button type="button" className="btn-ghost" onClick={onBackToSim}>→ חזרה לשאלות</button>
        <button type="button" className="btn-soft-coach" onClick={onPracticeWeak}>🔁 תרגול חוזר של החלשות</button>
        <button type="button" className="btn-ghost" onClick={onRestart}>✨ סשן חדש</button>
      </div>
    </div>
  );
}
