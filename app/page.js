'use client';
import { useEffect, useState } from 'react';
import InputStage from '@/components/InputStage';
import ProfileSummary from '@/components/ProfileSummary';
import Simulator from '@/components/Simulator';
import Report from '@/components/Report';
import { Spinner, api } from '@/components/ui';

const STORAGE_KEY = 'ips-session-v1';
const STEPS = [
  ['input', 'קליטת האתר'],
  ['profile', 'הבנת העסק'],
  ['sim', 'הפגישה'],
  ['report', 'דוח מוכנות'],
];

const fresh = () => ({ stage: 'input', profile: null, source: null, mode: null, warning: null, persona: 'angel', items: [], index: 0, report: null });

export default function Home() {
  const [s, setS] = useState(fresh);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const set = (patch) => setS((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));

  // restore / persist session (per browser, best effort)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved?.stage) setS({ ...fresh(), ...saved });
    } catch {}
    setLoaded(true);
    fetch('/api/status').then((r) => r.json()).then((d) => setAiEnabled(!!d.ai)).catch(() => {});
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
  }, [s, loaded]);

  const onMode = (mode, warning) => set((p) => ({ mode, warning: warning || p.warning }));

  async function startSession(persona, length) {
    setBusy('questions');
    setError(null);
    try {
      const res = await api('/api/questions', { profile: s.profile, persona, length, demo });
      onMode(res.mode, res.warning);
      const items = res.data.questions.map((q) => ({ ...q, attempts: [], hintLevel: 0 }));
      set({ stage: 'sim', persona, items, index: 0, report: null });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function finish() {
    setBusy('summary');
    setError(null);
    try {
      const items = s.items.map(({ id, category, question, isFollowUp, hintLevel, attempts }) => ({ id, category, question, isFollowUp, hintLevel, attempts }));
      const res = await api('/api/summary', { profile: s.profile, persona: s.persona, items, demo });
      onMode(res.mode, res.warning);
      set({ stage: 'report', report: res.data });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  function practiceWeak() {
    const weak = s.items.filter((i) => {
      const best = i.attempts?.length ? Math.max(...i.attempts.map((a) => a.evaluation.score)) : 0;
      return best < 8 || i.hintLevel > 0;
    });
    const list = (weak.length ? weak : s.items).map((i) => ({ id: `${i.id}-r${Date.now() % 10000}`, category: i.category, question: i.question, why: i.why, isFollowUp: i.isFollowUp, attempts: [], hintLevel: 0 }));
    set({ stage: 'sim', items: list, index: 0, report: null });
  }

  function restart() {
    if (s.stage === 'sim' && s.items.some((i) => i.attempts?.length) && !confirm('להתחיל סשן חדש? ההתקדמות הנוכחית תימחק.')) return;
    setS(fresh());
  }

  const stepIdx = STEPS.findIndex(([k]) => k === s.stage);

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <button type="button" onClick={restart} className="flex items-center gap-2 text-right" title="סשן חדש">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-investor-600 to-coach-600 text-lg text-white">🎤</span>
            <span className="leading-tight">
              <span className="block text-sm font-extrabold">Investor Pitch Simulator</span>
              <span className="block text-xs text-slate-500">סימולטור פגישת משקיעים</span>
            </span>
          </button>
          <nav className="hidden items-center gap-1 md:flex" aria-label="שלבים">
            {STEPS.map(([k, label], i) => (
              <span key={k} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${i === stepIdx ? 'bg-investor-100 text-investor-700 dark:bg-investor-900/60 dark:text-investor-100' : i < stepIdx ? 'text-coach-600' : 'text-slate-400'}`}>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${i < stepIdx ? 'bg-coach-600 text-white' : i === stepIdx ? 'bg-investor-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>{i < stepIdx ? '✓' : i + 1}</span>
                {label}
              </span>
            ))}
          </nav>
          {s.stage === 'sim' ? (
            <button type="button" className="btn-primary px-3 py-2" onClick={finish} disabled={busy === 'summary' || !s.items.some((i) => i.attempts?.length)}>
              {busy === 'summary' ? (<><Spinner /> מכין דוח…</>) : '🏁 סיום וסיכום'}
            </button>
          ) : (
            <span className="w-24" />
          )}
        </div>
      </header>

      <main className="px-4 py-8 sm:py-10">
        {error && (
          <div className="mx-auto mb-4 max-w-4xl rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200" role="alert">
            {error} <button className="mr-2 underline" onClick={() => setError(null)}>סגור</button>
          </div>
        )}

        {!loaded ? (
          <div className="flex justify-center py-20 text-slate-400"><Spinner className="h-8 w-8" /></div>
        ) : s.stage === 'input' ? (
          <InputStage aiEnabled={aiEnabled} demo={demo} setDemo={setDemo} onAnalyzed={(d) => set({ stage: 'profile', profile: d.data, source: d.source, mode: d.mode, warning: d.warning || null })} />
        ) : s.stage === 'profile' ? (
          <ProfileSummary profile={s.profile} source={s.source} mode={s.mode} warning={s.warning} starting={busy === 'questions'} onBack={() => set({ stage: 'input' })} onStart={startSession} />
        ) : s.stage === 'sim' ? (
          <Simulator
            profile={s.profile}
            persona={s.persona}
            items={s.items}
            setItems={(fn) => set((p) => ({ items: typeof fn === 'function' ? fn(p.items) : fn }))}
            index={s.index}
            setIndex={(i) => set({ index: i })}
            demo={demo}
            onFinish={finish}
            onMode={onMode}
          />
        ) : (
          <Report report={s.report} profile={s.profile} persona={s.persona} mode={s.mode} items={s.items} onRestart={() => setS(fresh())} onPracticeWeak={practiceWeak} onBackToSim={() => set({ stage: 'sim' })} />
        )}
      </main>

      <footer className="no-print pb-8 text-center text-xs text-slate-400">
        התרגול נשמר בדפדפן שלך בלבד · {aiEnabled ? 'מופעל ע״י Claude' : 'מצב דמו — הוסיפו ANTHROPIC_API_KEY לניתוח מבוסס Claude'}
      </footer>
    </>
  );
}
