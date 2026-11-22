'use client';
import { useEffect, useRef, useState } from 'react';

/** Speech-to-text via the Web Speech API (Chrome / Edge / Safari). Appends recognized text to the answer. */
export default function VoiceButton({ onText, disabled }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recRef = useRef(null);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition));
    return () => recRef.current?.abort?.();
  }, []);

  function toggle() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = 'he-IL';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let finalText = '';
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interimText += t;
      }
      if (finalText) onText(finalText.trim());
      setInterim(interimText);
    };
    rec.onend = () => { setListening(false); setInterim(''); };
    rec.onerror = () => { setListening(false); setInterim(''); };
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  if (!supported) {
    return <span className="text-xs text-slate-400" title="הדפדפן לא תומך בזיהוי דיבור (נסו Chrome)">🎙️ הקלטה לא נתמכת בדפדפן זה</span>;
  }
  return (
    <div className="flex min-w-0 items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        className={`btn-ghost px-3 py-2 ${listening ? '!border-rose-400 !bg-rose-50 !text-rose-700 dark:!bg-rose-950/50 dark:!text-rose-200' : ''}`}
        aria-pressed={listening}
      >
        {listening ? (<><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" /> עצור הקלטה</>) : '🎙️ ענו בקול'}
      </button>
      {interim && <span className="truncate text-xs italic text-slate-500">{interim}…</span>}
    </div>
  );
}
