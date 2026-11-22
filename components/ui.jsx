'use client';
import { labelForScore } from '@/lib/constants';

export function Spinner({ className = 'h-4 w-4' }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} aria-hidden />;
}

export function ProgressBar({ value, max, className = '' }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 ${className}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-gradient-to-l from-investor-500 to-coach-500 transition-all duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

const TONE = {
  good: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
  mid: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
  bad: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200',
};

export function ScoreBadge({ score, large = false }) {
  const l = labelForScore(score);
  return (
    <div className="flex items-center gap-3">
      <div className={`flex items-baseline gap-0.5 rounded-2xl px-3 py-1.5 font-extrabold ${TONE[l.tone]} ${large ? 'text-3xl' : 'text-lg'}`}>
        {score}
        <span className="text-xs font-semibold opacity-70">/10</span>
      </div>
      <span className={`chip ${TONE[l.tone]}`}>{l.text}</span>
    </div>
  );
}

export function scoreTone(score) {
  if (score == null) return 'text-slate-400';
  if (score >= 8) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 6) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

export function ModeBadge({ mode }) {
  if (!mode) return null;
  return mode === 'ai' ? (
    <span className="chip bg-investor-100 text-investor-700 dark:bg-investor-900/60 dark:text-investor-100">✨ מופעל ע״י Claude</span>
  ) : (
    <span className="chip bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300" title="אין מפתח API — הניתוח מתבצע במנוע מקומי חכם">🧪 מצב דמו (מנוע מקומי)</span>
  );
}

export function List({ items, icon = '•', className = '' }) {
  if (!items?.length) return null;
  return (
    <ul className={`space-y-1.5 ${className}`}>
      {items.map((t, i) => (
        <li key={i} className="flex gap-2 leading-relaxed">
          <span className="mt-0.5 shrink-0">{icon}</span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export async function api(path, body) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'שגיאה בשרת');
    Object.assign(err, data);
    throw err;
  }
  return data;
}
