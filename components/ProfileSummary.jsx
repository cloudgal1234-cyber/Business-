'use client';
import { useState } from 'react';
import { PERSONAS, LENGTHS } from '@/lib/constants';
import { List, ModeBadge, Spinner } from './ui';

function Field({ label, children }) {
  return (
    <div>
      <div className="mb-1 text-xs font-bold text-slate-500 dark:text-slate-400">{label}</div>
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

export default function ProfileSummary({ profile, source, mode, warning, onStart, onBack, starting }) {
  const [persona, setPersona] = useState('angel');
  const [length, setLength] = useState('short');

  return (
    <div className="mx-auto max-w-4xl animate-fadeIn space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold">סיכום הבנת העסק</h2>
          <p className="text-sm text-slate-500">ככה המשקיע יבין את העסק מהאתר. בדקו שזה מדויק לפני שמתחילים.</p>
        </div>
        <ModeBadge mode={mode} />
      </div>

      {(warning || source?.notes?.length > 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {[warning, ...(source?.notes || [])].filter(Boolean).map((n, i) => <p key={i}>⚠️ {n}</p>)}
        </div>
      )}

      <div className="card p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-xl font-extrabold">{profile.businessName}</h3>
            <p className="text-slate-600 dark:text-slate-400">{profile.oneLiner}</p>
          </div>
          <span className="chip bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{profile.industry}</span>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="🏢 מה העסק עושה">{profile.whatItDoes}</Field>
          <Field label="👥 קהל היעד">{profile.targetAudience}</Field>
          <Field label="💰 המודל העסקי">{profile.businessModel}</Field>
          <Field label="🏷️ תמחור">{profile.pricing}</Field>
          <Field label="📦 מוצרים / שירותים">{profile.products?.join(' · ')}</Field>
          <Field label="📈 סימני משיכה">{profile.tractionSignals?.length ? profile.tractionSignals.join(' · ') : 'לא נמצאו'}</Field>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/30">
            <div className="mb-2 font-bold text-emerald-800 dark:text-emerald-300">מה עובד טוב באתר</div>
            <List items={profile.strengths} icon="✅" className="text-sm" />
          </div>
          <div className="rounded-xl bg-rose-50 p-4 dark:bg-rose-950/30">
            <div className="mb-2 font-bold text-rose-800 dark:text-rose-300">מה נראה שחסר באתר</div>
            <List items={profile.gaps} icon="🔍" className="text-sm" />
          </div>
        </div>
        {source?.type === 'url' && (
          <p className="mt-4 text-xs text-slate-500">
            נסרקו {source.pages?.length || 1} דפים מתוך <span className="ltr">{source.url}</span>
            {source.via === 'reader' && ' (דרך שירות קריאה חלופי)'}
          </p>
        )}
      </div>

      <div className="card p-5 sm:p-6">
        <h3 className="mb-4 text-lg font-extrabold">הגדרת הפגישה</h3>
        <div className="mb-2 text-sm font-semibold">מול מי אתם יושבים?</div>
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          {Object.values(PERSONAS).map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPersona(p.key)}
              aria-pressed={persona === p.key}
              className={`rounded-2xl border-2 p-4 text-right transition ${persona === p.key ? 'border-investor-500 bg-investor-50 dark:bg-investor-900/30' : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700'}`}
            >
              <div className="mb-1 flex items-center gap-2 font-bold"><span className="text-2xl">{p.avatar}</span>{p.name}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">{p.description}</div>
            </button>
          ))}
        </div>
        <div className="mb-2 text-sm font-semibold">אורך הסשן</div>
        <div className="mb-6 grid grid-cols-2 gap-3">
          {Object.values(LENGTHS).map((l) => (
            <button
              key={l.key}
              type="button"
              onClick={() => setLength(l.key)}
              aria-pressed={length === l.key}
              className={`rounded-xl border-2 px-4 py-3 text-right transition ${length === l.key ? 'border-investor-500 bg-investor-50 dark:bg-investor-900/30' : 'border-slate-200 hover:border-slate-300 dark:border-slate-800'}`}
            >
              <div className="font-bold">{l.label}</div>
              <div className="text-xs text-slate-500">{l.description}</div>
            </button>
          ))}
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <button type="button" className="btn-ghost" onClick={onBack}>→ חזרה ועריכה</button>
          <button type="button" className="btn-primary px-6 py-3 text-base" onClick={() => onStart(persona, length)} disabled={starting}>
            {starting ? (<><Spinner /> המשקיע מכין שאלות…</>) : 'התחילו את הפגישה ←'}
          </button>
        </div>
      </div>
    </div>
  );
}
