// The controller: connects the engine (rules) with speech in/out and timers.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createInitialState, customerSends, cookSays, noReply, pressButton, tick, setSpeakingAs, TIMING } from '../core/store.js';
import { speak, stopSpeaking, chime, ttsAvailable } from '../speech/tts.js';
import { BrowserRecognizer, WisprRecognizer, browserSpeechAvailable } from '../speech/recognizers.js';

const STORAGE_KEY = 'nirhast-demo-v1';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s?.version === 1) return { ...s, dialog: null, quietUntil: null };
    }
  } catch { /* storage unavailable: start fresh */ }
  return createInitialState();
}
function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function useNirhast() {
  const [state, setState] = useState(loadState);
  const stateRef = useRef(state);
  const [offsetMs, setOffsetMs] = useState(0); // DEMO clock skip
  const offsetRef = useRef(0);
  const [mic, setMic] = useState('off'); // off | listening | speaking | paused | error
  const [engine, setEngine] = useState({ name: 'none', note: 'Kitchen not started' });
  const [config, setConfig] = useState({ wispr: false, checked: false });
  const [line, setLine] = useState(null); // last spoken line { text, kind, orderId }
  const [heard, setHeard] = useState(null); // { text, status: 'heard'|'saved'|'ignored' }
  const [interim, setInterim] = useState('');
  const [phrase, setPhrase] = useState(null);
  const [error, setError] = useState(null);
  const [started, setStarted] = useState(false);
  const [now, setNow] = useState(Date.now());

  const recRef = useRef(null);
  const startedRef = useRef(false);
  const queueRef = useRef([]);
  const speakingRef = useRef(false);
  const pendingListenRef = useRef(null);
  const windowRef = useRef(null); // { deadline, expect }
  const lastInterimRef = useRef(0);

  const clock = useCallback(() => Date.now() + offsetRef.current, []);

  const commit = useCallback((next) => {
    stateRef.current = next;
    setState(next);
    saveState(next);
  }, []);

  // ---------- speech out ----------
  const drainQueue = useCallback(async () => {
    if (speakingRef.current) return;
    speakingRef.current = true;
    recRef.current?.pause(); // half-duplex: never listen to our own voice
    while (queueRef.current.length) {
      const item = queueRef.current.shift();
      setLine(item);
      setMic('speaking');
      await speak(item.text);
    }
    speakingRef.current = false;
    const expect = pendingListenRef.current;
    pendingListenRef.current = null;
    if (expect) {
      chime();
      recRef.current?.setEndSilence(expect === 'number' ? TIMING.silenceNumberMs : TIMING.silenceMs);
      windowRef.current = { deadline: Date.now() + TIMING.listenWindowMs, expect };
    }
    if (recRef.current) { recRef.current.resume(); setMic('listening'); } else setMic(startedRef.current ? 'typed' : 'off');
  }, []);

  const runEffects = useCallback((effects) => {
    for (const e of effects) {
      if (e.type === 'say') queueRef.current.push({ text: e.text, kind: e.kind, orderId: e.orderId });
      else if (e.type === 'listen') pendingListenRef.current = e.expect;
      else if (e.type === 'stopSpeaking') { queueRef.current = []; stopSpeaking(); }
      else if (e.type === 'showPhrase') setPhrase(e.phrase);
      else if (e.type === 'ignored') setHeard({ text: e.text, status: 'ignored' });
      if (e.type === 'say' && e.kind === 'saved') setHeard((h) => (h ? { ...h, status: 'saved' } : h));
    }
    if (queueRef.current.length) drainQueue();
    else if (pendingListenRef.current) drainQueue();
  }, [drainQueue]);

  const apply = useCallback((fn) => {
    const r = fn(stateRef.current);
    commit(r.state);
    runEffects(r.effects);
    return r;
  }, [commit, runEffects]);

  // ---------- inputs ----------
  const handleCookText = useCallback((text, source = 'voice') => {
    if (!text || !text.trim()) return;
    if (speakingRef.current) {
      if (source === 'voice') return; // half-duplex guard: ignore what the mic hears while we speak
      queueRef.current = []; stopSpeaking(); // typed input interrupts
    }
    windowRef.current = null;
    setInterim('');
    setHeard({ text, status: 'heard' });
    if (!/phrase/.test(stateRef.current.dialog?.kind || '')) setPhrase(null);
    apply((s) => cookSays(s, text, clock()));
  }, [apply, clock]);

  const sendCustomer = useCallback((customerId, text) => {
    if (!text.trim()) return;
    apply((s) => customerSends(s, customerId, text.trim(), clock()));
  }, [apply, clock]);

  const press = useCallback((orderId, answer) => apply((s) => pressButton(s, orderId, answer, clock())), [apply, clock]);

  const setSpeaker = useCallback((who) => commit(setSpeakingAs(stateRef.current, who)), [commit]);

  const ruko = useCallback(() => { queueRef.current = []; stopSpeaking(); }, []);

  const skipMinutes = useCallback((m) => {
    offsetRef.current += m * 60 * 1000;
    setOffsetMs(offsetRef.current);
  }, []);

  const reset = useCallback(() => {
    queueRef.current = []; stopSpeaking();
    windowRef.current = null; setLine(null); setHeard(null); setPhrase(null);
    offsetRef.current = 0; setOffsetMs(0);
    commit(createInitialState());
  }, [commit]);

  // ---------- start the kitchen (needs a tap so the browser allows mic + audio) ----------
  const start = useCallback(async () => {
    setError(null);
    setStarted(true);
    startedRef.current = true;
    const onText = (t) => handleCookText(t);
    const onInterim = (t) => { lastInterimRef.current = Date.now(); setInterim(t); };
    const onState = (st, msg) => { if (st === 'error') { setMic('error'); setError(msg || 'Mic error'); } };
    try {
      if (config.wispr) {
        const rec = new WisprRecognizer({
          onText, onState,
          onError: (m) => { setError(`Abhi sun nahi pa rahi (${m}). Buttons ya typing use karein.`); },
          dictionary: () => [...stateRef.current.menu.map((m) => m.name), ...stateRef.current.customers.map((c) => c.name)],
        });
        await rec.start();
        recRef.current = rec;
        setEngine({ name: 'wispr', note: 'Wispr Flow API' });
      } else if (browserSpeechAvailable()) {
        const rec = new BrowserRecognizer({ onText, onInterim, onState, lang: 'hi-IN' });
        rec.start();
        recRef.current = rec;
        setEngine({ name: 'browser', note: 'Browser speech (demo: no Wispr key set)' });
      } else {
        setEngine({ name: 'none', note: 'No speech recognition here. Type below.' });
      }
      setMic(recRef.current ? 'listening' : 'typed');
    } catch (err) {
      setMic('error');
      setError(`Abhi sun nahi pa rahi: ${err?.message || err}. Buttons ya typing use karein.`);
      setEngine({ name: 'none', note: 'Mic not available. Type below.' });
    }
    if (!ttsAvailable()) setError((e) => e || 'This browser cannot speak. Lines are shown on screen.');
    apply((s) => tick(s, clock()));
  }, [config.wispr, handleCookText, apply, clock]);

  // ---------- timers ----------
  useEffect(() => {
    fetch('api/config').then((r) => (r.ok ? r.json() : { wispr: false })).catch(() => ({ wispr: false }))
      .then((c) => setConfig({ wispr: Boolean(c.wispr), checked: true }));
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const t = clock();
      setNow(t);
      // Listening window: nothing heard in 6 s -> engine decides (repeat once, then ladder)
      const w = windowRef.current;
      if (w && !speakingRef.current && Date.now() > w.deadline && Date.now() - lastInterimRef.current > 1500) {
        windowRef.current = null;
        if (stateRef.current.dialog) apply((s) => noReply(s, clock()));
      }
      if (startedRef.current && !speakingRef.current) {
        const r = tick(stateRef.current, t);
        if (r.effects.length || JSON.stringify(r.state) !== JSON.stringify(stateRef.current)) { commit(r.state); runEffects(r.effects); }
      }
    }, 500);
    return () => clearInterval(id);
  }, [apply, clock, commit, runEffects]);

  useEffect(() => () => { recRef.current?.stop(); stopSpeaking(); }, []);

  return {
    state, now, offsetMs, mic, engine, config, line, heard, interim, phrase, error, started,
    start, handleCookText, sendCustomer, press, setSpeaker, ruko, skipMinutes, reset,
    listening: Boolean(windowRef.current),
  };
}
