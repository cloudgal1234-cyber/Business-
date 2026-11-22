'use client';
import { useEffect, useRef, useState } from 'react';
import { PERSONAS, categoryByKey, WEAK_THRESHOLD } from '@/lib/constants';
import { List, ProgressBar, ScoreBadge, Spinner, api, scoreTone } from './ui';
import VoiceButton from './VoiceButton';

const HINT_TITLES = ['מה המשקיע באמת בודק כאן?', 'שלד לתשובה מנצחת', 'פתיח מוכן להשלמה'];

/* ---------------- investor side ---------------- */
function InvestorBubble({ persona, item }) {
  const p = PERSONAS[persona];
  const cat = categoryByKey[item.category];
  return (
    <div className="flex gap-3">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-investor-600 text-2xl shadow-md shadow-investor-500/30">{p.avatar}</div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-investor-700 dark:text-investor-100">{p.name}</span>
          <span className="chip bg-investor-100 text-investor-700 dark:bg-investor-900/60 dark:text-investor-100">{cat.icon} {cat.label}</span>
          {item.isFollowUp && <span className="chip bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">↩︎ שאלת המשך</span>}
        </div>
        <div className="rounded-2xl rounded-tr-sm border border-investor-100 bg-investor-50 p-4 text-lg font-semibold leading-relaxed text-investor-900 dark:border-investor-900 dark:bg-investor-900/40 dark:text-investor-50">
          {item.question}
        </div>
      </div>
    </div>
  );
}

/* ---------------- coach side ---------------- */
function CoachShell({ title, children, tone = 'coach' }) {
  return (
    <div className={`animate-fadeIn rounded-2xl border p-4 sm:p-5 ${tone === 'coach' ? 'border-coach-500/30 bg-coach-50/70 dark:bg-coach-900/20' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-coach-600 text-lg">🧭</div>
        <div>
          <div className="text-xs font-bold text-coach-700 dark:text-coach-100">המאמן האישי</div>
          <div className="font-extrabold">{title}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function HintPanel({ hints, level, onMore, loading, onUseOpener }) {
  return (
    <CoachShell title="עזרה מדורגת">
      {loading && !hints && <div className="flex items-center gap-2 text-sm text-coach-700 dark:text-coach-100"><Spinner /> המאמן חושב…</div>}
      {hints && (
        <div className="space-y-3">
          {[0, 1, 2].filter((i) => i < level).map((i) => (
            <div key={i} className="animate-fadeIn rounded-xl bg-white/80 p-3 dark:bg-slate-900/60">
              <div className="mb-1 text-xs font-bold text-coach-700 dark:text-coach-100">רמה {i + 1} — {HINT_TITLES[i]}</div>
              {i === 0 && <p className="leading-relaxed">{hints.intent}</p>}
              {i === 1 && (
                <ol className="space-y-1.5">
                  {hints.skeleton.map((s, k) => (
                    <li key={k} className="flex gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-coach-600 text-xs font-bold text-white">{k + 1}</span><span className="leading-relaxed">{s}</span></li>
                  ))}
                </ol>
              )}
              {i === 2 && (
                <div>
                  <p className="rounded-lg border border-dashed border-coach-500/50 p-3 font-medium leading-relaxed">{hints.opener}</p>
                  <button type="button" className="btn-soft-coach mt-2 px-3 py-1.5 text-xs" onClick={() => onUseOpener(hints.opener)}>הכנס לתשובה והשלם ✍️</button>
                </div>
              )}
            </div>
          ))}
          {level < 3 && (
            <button type="button" className="btn-soft-coach text-xs" onClick={onMore}>עדיין תקוע? עוד רמת עזרה ({level + 1}/3)</button>
          )}
        </div>
      )}
    </CoachShell>
  );
}

function ImprovedAnswer({ text, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70">
      <button type="button" className="flex w-full items-center justify-between p-3 text-right text-sm font-bold" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>💡 דוגמה לתשובה משופרת (ברמת יזם מנוסה)</span>
        <span className="text-slate-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && <p className="whitespace-pre-line border-t border-slate-100 p-3 leading-relaxed dark:border-slate-800">{text}</p>}
    </div>
  );
}

function CoachPanel({ evaluation, onRetry, onNext, isLast }) {
  const c = evaluation.coach || {};
  return (
    <CoachShell title="בוא נשפר את התשובה הזו יחד">
      <div className="mb-4"><ScoreBadge score={evaluation.score} /></div>
      {c.encouragement && <p className="mb-4 font-medium text-coach-900 dark:text-coach-100">{c.encouragement}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 text-sm font-bold">למה זה עוד לא ישכנע משקיע</div>
          <List items={c.whyWeak} icon="🔸" className="text-sm" />
        </div>
        <div>
          <div className="mb-2 text-sm font-bold">כדי לשפר, נסה לענות רגע על:</div>
          <ol className="space-y-1.5 text-sm">
            {(c.guidingQuestions || []).map((q, i) => (
              <li key={i} className="flex gap-2"><span className="font-bold text-coach-700 dark:text-coach-100">{'אבגד'[i]}.</span><span>{q}</span></li>
            ))}
          </ol>
        </div>
      </div>
      <div className="mt-4"><ImprovedAnswer text={evaluation.improvedAnswer} defaultOpen /></div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button type="button" className="btn-coach" onClick={onRetry}>🔁 נסה לענות שוב על השאלה</button>
        <button type="button" className="btn-ghost" onClick={onNext}>{isLast ? 'לסיכום הפגישה ←' : 'המשך בכל זאת לשאלה הבאה ←'}</button>
      </div>
    </CoachShell>
  );
}

function FeedbackPanel({ evaluation, prevBest, onFollowUp, onRetry, onNext, isLast, canFollowUp }) {
  return (
    <div className="animate-fadeIn rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="font-extrabold">ניתוח התשובה</div>
        <div className="flex items-center gap-2">
          {prevBest != null && evaluation.score > prevBest && <span className="chip bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">⬆ שיפור של {evaluation.score - prevBest} נק׳</span>}
          <ScoreBadge score={evaluation.score} large />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30">
          <div className="mb-2 text-sm font-bold text-emerald-800 dark:text-emerald-300">מה עבד טוב</div>
          <List items={evaluation.strengths} icon="✅" className="text-sm" />
        </div>
        <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/30">
          <div className="mb-2 text-sm font-bold text-amber-800 dark:text-amber-300">מה כדאי לחדד</div>
          <List items={evaluation.improvements} icon="🎯" className="text-sm" />
        </div>
      </div>
      <div className="mt-4"><ImprovedAnswer text={evaluation.improvedAnswer} /></div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {canFollowUp && evaluation.followUp && (
          <button type="button" className="btn-primary" onClick={onFollowUp}>↩︎ שאלת המשך (Follow-up)</button>
        )}
        <button type="button" className="btn-ghost" onClick={onRetry}>🔁 לנסות לשפר</button>
        <button type="button" className={canFollowUp ? 'btn-ghost' : 'btn-primary'} onClick={onNext}>{isLast ? 'לסיכום הפגישה ←' : 'לשאלה הבאה ←'}</button>
      </div>
    </div>
  );
}

/* ---------------- main ---------------- */
export default function Simulator({ profile, persona, items, setItems, index, setIndex, demo, onFinish, onMode }) {
  const item = items[index];
  const [busy, setBusy] = useState(false);
  const [hintLoading, setHintLoading] = useState(false);
  const [error, setError] = useState(null);
  const textRef = useRef(null);

  useEffect(() => { setError(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }, [index]);

  if (!item) return null;
  const update = (patch) => setItems((all) => all.map((it) => (it.id === item.id ? { ...it, ...(typeof patch === 'function' ? patch(it) : patch) } : it)));
  const phase = item.phase || 'answer';
  const last = item.attempts?.[item.attempts.length - 1];
  const answeredCount = items.filter((i) => i.attempts?.length).length;
  const isLast = index === items.length - 1;

  async function submit(answerOverride) {
    const answer = (answerOverride ?? item.draft ?? '').trim();
    setBusy(true);
    setError(null);
    try {
      const res = await api('/api/evaluate', {
        profile, persona, demo,
        question: item.question,
        category: item.category,
        answer,
        isFollowUp: !!item.isFollowUp,
        previousAttempts: (item.attempts || []).map((a) => a.answer).slice(-2),
      });
      onMode?.(res.mode, res.warning);
      const evaluation = res.data;
      update((it) => ({
        attempts: [...(it.attempts || []), { answer: answer || '(לא נענתה)', evaluation }],
        phase: evaluation.score < WEAK_THRESHOLD ? 'coach' : 'feedback',
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function requestHint() {
    const level = Math.min(3, (item.hintLevel || 0) + 1);
    update({ hintLevel: level });
    if (item.hints) return;
    setHintLoading(true);
    try {
      const res = await api('/api/hints', { profile, persona, demo, question: item.question, category: item.category });
      onMode?.(res.mode, res.warning);
      update({ hints: res.data });
    } catch (e) {
      setError(e.message);
      update({ hintLevel: (item.hintLevel || 0) });
    } finally {
      setHintLoading(false);
    }
  }

  function retry() {
    update({ phase: 'answer', draft: last?.answer && last.answer !== '(לא נענתה)' && last.answer !== 'לא יודע' ? last.answer : '' });
    setTimeout(() => textRef.current?.focus(), 50);
  }

  function next() {
    if (isLast) onFinish();
    else setIndex(index + 1);
  }

  function followUp() {
    const n = items.filter((i) => i.parentId === item.id).length + 1;
    const fu = {
      id: `${item.id}-f${n}`,
      parentId: item.id,
      category: item.category,
      question: last.evaluation.followUp,
      why: 'המשקיע לוחץ על נקודה שעלתה בתשובה שלך — בדיוק כמו בפגישה אמיתית.',
      isFollowUp: true,
      attempts: [],
    };
    setItems((all) => [...all.slice(0, index + 1), fu, ...all.slice(index + 1)]);
    setIndex(index + 1);
  }

  const bestPrev = item.attempts?.length > 1 ? Math.max(...item.attempts.slice(0, -1).map((a) => a.evaluation.score)) : null;

  return (
    <div className="mx-auto max-w-4xl animate-fadeIn">
      {/* progress */}
      <div className="card mb-5 p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-bold">שאלה {index + 1} מתוך {items.length}</span>
          <span className="text-slate-500">{answeredCount} נענו</span>
        </div>
        <ProgressBar value={answeredCount} max={items.length} />
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="ניווט בין שאלות">
          {items.map((it, i) => {
            const best = it.attempts?.length ? Math.max(...it.attempts.map((a) => a.evaluation.score)) : null;
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => setIndex(i)}
                title={`${categoryByKey[it.category].label}${best != null ? ` · ${best}/10` : ''}`}
                className={`flex h-8 min-w-8 items-center justify-center rounded-lg border px-1.5 text-xs font-bold transition ${i === index ? 'border-investor-500 bg-investor-600 text-white' : 'border-slate-200 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900'} ${i !== index ? scoreTone(best) : ''}`}
              >
                {it.isFollowUp ? '↩︎' : categoryByKey[it.category].icon}
                {best != null && <span className="mr-0.5">{best}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <InvestorBubble persona={persona} item={item} />

        {phase === 'answer' && (
          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <div className="card p-4 sm:p-5 lg:col-span-2">
              <label htmlFor="answer" className="mb-2 flex items-center justify-between text-sm font-bold">
                <span>התשובה שלכם</span>
                {item.attempts?.length > 0 && <span className="chip bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">ניסיון {item.attempts.length + 1}</span>}
              </label>
              <textarea
                id="answer"
                ref={textRef}
                className="input min-h-[160px] resize-y leading-relaxed"
                placeholder="ענו כאילו אתם בפגישה. נסו לכלול מספרים, דוגמה אמיתית ומשפט סיכום חד…"
                value={item.draft || ''}
                onChange={(e) => update({ draft: e.target.value })}
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && (item.draft || '').trim()) submit(); }}
                disabled={busy}
              />
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <VoiceButton disabled={busy} onText={(t) => update((it) => ({ draft: ((it.draft || '') + ' ' + t).trim() }))} />
                  <span className="hidden text-xs text-slate-400 sm:inline">{(item.draft || '').trim().split(/\s+/).filter(Boolean).length} מילים</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-soft-coach" onClick={requestHint} disabled={busy || (item.hintLevel || 0) >= 3}>
                    🆘 נתקעתי / צריך עזרה
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => submit('לא יודע')} disabled={busy} title="המאמן יעזור לבנות את התשובה">
                    🤷 לא יודע
                  </button>
                  <button type="button" className="btn-primary" onClick={() => submit()} disabled={busy || !(item.draft || '').trim()}>
                    {busy ? (<><Spinner /> המשקיע מקשיב…</>) : 'שליחת תשובה'}
                  </button>
                </div>
              </div>
              {error && <p className="mt-3 text-sm text-rose-600" role="alert">{error}</p>}
            </div>
            {(item.hintLevel || 0) > 0 && (
              <div className="lg:col-span-2">
                <HintPanel hints={item.hints} level={item.hintLevel} loading={hintLoading} onMore={requestHint} onUseOpener={(t) => { update((it) => ({ draft: it.draft ? `${it.draft}\n${t}` : t })); textRef.current?.focus(); }} />
              </div>
            )}
          </div>
        )}

        {phase !== 'answer' && last && (
          <>
            <div className="flex justify-end">
              <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-slate-200 p-4 leading-relaxed dark:bg-slate-800">
                <div className="mb-1 text-xs font-bold text-slate-500">התשובה שלך</div>
                <p className="whitespace-pre-line">{last.answer}</p>
              </div>
            </div>
            {phase === 'coach' ? (
              <CoachPanel evaluation={last.evaluation} onRetry={retry} onNext={next} isLast={isLast} />
            ) : (
              <FeedbackPanel
                evaluation={last.evaluation}
                prevBest={bestPrev}
                onFollowUp={followUp}
                onRetry={retry}
                onNext={next}
                isLast={isLast}
                canFollowUp={!items.some((i) => i.parentId === item.id) && items.filter((i) => i.isFollowUp).length < 6}
              />
            )}
          </>
        )}

        <p className="text-center text-xs text-slate-400">💬 {item.why}</p>
      </div>
    </div>
  );
}

