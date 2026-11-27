// The controller: connects the engine (rules) with speech in/out, AI sorting and timers.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createInitialState, customerSends, cookSays, noReply, pressButton, tick, setSpeakingAs, setLang as setLangRule, toggleToday, setHours, updateItem, addItem, removeItem, bump, TIMING } from '../core/store.js';
import { cookRuleText, MIN_CONFIDENCE, ESCALATE_TYPES } from '../core/intents.js';
import { LANGS, safeLang, line as i18nLine, WEEKDAYS, clockLabel } from '../core/i18n.js';
import { sampleHistory, dayKey } from '../core/history.js';
import { forecast as makeForecast } from '../core/forecast.js';
import { speak, stopSpeaking, ttsAvailable } from '../speech/tts.js';
import { playSound, preloadSounds, soundCues } from '../speech/sounds.js';
import { BrowserRecognizer, WisprRecognizer, browserSpeechAvailable } from '../speech/recognizers.js';
import { makeT } from './uiText.js';

const STORAGE_KEY = 'nirhast-demo-v2';
const AI_TIMEOUT_MS = 5000;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s?.version === 1) return { ...s, lang: safeLang(s.lang), dialog: null, quietUntil: null };
    }
  } catch { /* storage unavailable: start fresh */ }
  return { ...createInitialState('en'), langChosen: false };
}
function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function useNirhast() {
  const [state, setState] = useState(loadState);
  const stateRef = useRef(state);
  const [mic, setMic] = useState('off'); // off | listening | speaking | paused | typed | error
  const [engine, setEngine] = useState('none'); // wispr | groq | browser | none
  const [config, setConfig] = useState({ wispr: false, groq: false, sarvam: false, translateFirst: false, stt: null, checked: false });
  const configRef = useRef(config);
  const [line, setLine] = useState(null); // last spoken line { text, kind, orderId }
  const [heard, setHeard] = useState(null); // { text, status: 'heard'|'saved'|'ignored', label }
  const [interim, setInterim] = useState('');
  const [phrase, setPhrase] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null); // AI or voice fell back to the no-key path
  const [started, setStarted] = useState(false);
  const [now, setNow] = useState(Date.now());
  // Past days from the server's database (or sample history made here when there is no server, e.g. the static live link)
  const [history, setHistory] = useState({ orders: [], feedback: [], stats: [], sample: false, loaded: false });

  const recRef = useRef(null);
  const startedRef = useRef(false);
  const queueRef = useRef([]);
  const speakingRef = useRef(false);
  const pendingListenRef = useRef(null);
  const windowRef = useRef(null); // { deadline, expect }
  const lastInterimRef = useRef(0);
  const micBrokenRef = useRef(false); // mic failed: never show "listening" again until restart
  const micOffRef = useRef(false); // the cook pressed STOP: mic stays off until she presses LISTEN

  const tr = useCallback((key, p) => makeT(stateRef.current.lang)(key, p), []);
  const clock = useCallback(() => Date.now(), []);

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
      if (item.sound) { await playSound(item.sound); continue; } // cue: mic stays paused while it plays
      setLine(item);
      setMic('speaking');
      await speak(item.text, {
        lang: stateRef.current.lang,
        sarvam: configRef.current.sarvam,
        onFallback: (m) => setNotice(`Sarvam: ${m}. Browser voice used (Demo).`),
      });
    }
    const expect = pendingListenRef.current;
    pendingListenRef.current = null;
    if (expect) await playSound('micOn'); // before the mic resumes, so it doesn't hear the cue
    speakingRef.current = false;
    if (queueRef.current.length) { // something new came in during the cue: say it, then open the window
      if (expect && !pendingListenRef.current) pendingListenRef.current = expect;
      drainQueue();
      return;
    }
    if (expect && !micOffRef.current) { // mic switched off by the cook: no listening window, buttons still work
      recRef.current?.setEndSilence(expect === 'number' ? TIMING.silenceNumberMs : TIMING.silenceMs);
      windowRef.current = { deadline: Date.now() + TIMING.listenWindowMs, expect };
    }
    if (micBrokenRef.current) setMic('error');
    else if (micOffRef.current) setMic('paused');
    else if (recRef.current) { recRef.current.resume(); setMic('listening'); } else setMic(startedRef.current ? 'typed' : 'off');
  }, []);

  const runEffects = useCallback((effects, cues = []) => {
    for (const c of cues) queueRef.current.push({ sound: c });
    for (const e of effects) {
      if (e.type === 'say') queueRef.current.push({ text: e.text, kind: e.kind, orderId: e.orderId });
      else if (e.type === 'listen') pendingListenRef.current = e.expect;
      else if (e.type === 'stopSpeaking') { queueRef.current = []; stopSpeaking(); }
      else if (e.type === 'showPhrase') setPhrase(e.phrase);
      else if (e.type === 'ignored') setHeard((h) => ({ ...(h || {}), text: e.text, status: 'ignored' }));
      if (e.type === 'say' && e.kind === 'saved') setHeard((h) => (h ? { ...h, status: 'saved' } : h));
    }
    if (queueRef.current.length) drainQueue();
    else if (pendingListenRef.current) drainQueue();
  }, [drainQueue]);

  const apply = useCallback((fn) => {
    const prev = stateRef.current;
    const r = fn(prev);
    commit(r.state);
    runEffects(r.effects, soundCues(prev, r.state, Date.now()));
    return r;
  }, [commit, runEffects]);

  // ---------- translation (Sarvam, only when the server has its key) ----------
  // Returns the translated text, or null (no key, same language, or failure: then the original words are used).
  const translate = useCallback(async (text, to) => {
    if (!configRef.current.sarvam || !text?.trim()) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
    try {
      const r = await fetch('api/translate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
        body: JSON.stringify({ text, to }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(r.status === 429 ? 'rate limit' : body?.message || `error ${r.status}`);
      const out = (body.text || '').trim();
      return out && out !== text.trim() ? out : null;
    } catch (err) {
      setNotice(tr('translateFallback', { msg: err?.name === 'AbortError' ? 'timeout' : String(err?.message || err) }));
      return null;
    } finally {
      clearTimeout(timer);
    }
  }, [tr]);

  // ---------- AI sorting (only when the server has a Groq key) ----------
  const sortWithAI = useCallback(async (role, text) => {
    if (!configRef.current.groq) return null;
    const s = stateRef.current;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
    try {
      // English first: the AI sees the original and an English translation (the original wins).
      const english = configRef.current.translateFirst ? await translate(text, 'en') : null;
      const r = await fetch('api/sort', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
        body: JSON.stringify({
          role, text, english,
          context: {
            question: role === 'cook' ? s.dialog?.prompt || null : null,
            menu: s.menu.map((m) => ({ id: m.id, names: [m.name, ...Object.values(m.names || {})] })),
            customers: s.customers.map((c) => c.name),
          },
        }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(r.status === 429 ? 'rate limit' : body?.message || `error ${r.status}`);
      setNotice(null);
      return english ? { ...body, english } : body;
    } catch (err) {
      setNotice(tr('aiFallback', { msg: err?.name === 'AbortError' ? 'timeout' : String(err?.message || err) }));
      return null;
    } finally {
      clearTimeout(timer);
    }
  }, [tr, translate]);

  // ---------- inputs ----------
  // source: 'voice' (mic), 'typed' (free typing, sorted by AI), 'button' (fixed words, no AI needed)
  const handleCookText = useCallback(async (text, source = 'voice') => {
    if (!text || !text.trim()) return;
    if (speakingRef.current) {
      if (source === 'voice') return; // half-duplex guard: ignore what the mic hears while we speak
      queueRef.current = []; stopSpeaking(); // typed input interrupts
    }
    if (windowRef.current) playSound('micOff'); // the answer was heard: listening window closes
    windowRef.current = null;
    setInterim('');
    setHeard({ text, status: 'heard' });
    const d = stateRef.current.dialog;
    if (d?.kind !== 'phrase') setPhrase(null);
    // The owner phrase check and free answers use the exact words, never an AI label.
    const rawOnly = source === 'button' || d?.kind === 'phrase' || (d?.kind === 'ownerQ' && d.stage === 'answer');
    let ruleText = null;
    const extra = {};
    if (d?.kind === 'ownerQ' && d.stage === 'answer') {
      const s = stateRef.current;
      const q = s.ownerQueue.find((x) => x.id === d.questionId);
      const custLang = s.customers.find((c) => c.id === q?.customerId)?.lang || s.lang;
      if (custLang !== s.lang) {
        // Short replies can be mistranslated, so the customer always gets the cook's own words too.
        const out = await translate(text, custLang);
        if (out) extra.answerForCustomer = i18nLine(custLang, 'cTranslated', { orig: text, tr: out });
      }
    }
    if (!rawOnly) {
      const sorted = await sortWithAI('cook', text);
      if (sorted) {
        setHeard((h) => (h && h.text === text ? { ...h, label: sorted } : h));
        if (sorted.type === 'background' && (sorted.confidence ?? 1) >= MIN_CONFIDENCE) {
          setHeard((h) => (h ? { ...h, status: 'ignored' } : h));
          return;
        }
        ruleText = cookRuleText(sorted, stateRef.current);
      }
    }
    const r = apply((s) => cookSays(s, text, clock(), ruleText, extra));
    // "Done by voice": something was saved without touching the phone.
    if (source !== 'button' && r.effects.some((e) => e.type === 'say' && e.kind === 'saved')) commit(bump(stateRef.current, 'handsFree', clock()));
  }, [apply, clock, sortWithAI, translate]);

  const sendCustomer = useCallback(async (customerId, text, source = 'typed') => {
    if (!text.trim()) return;
    const msg = text.trim();
    const sorted = source === 'chip' ? null : await sortWithAI('customer', msg);
    // If it may go to the owner, read it to the cook in the app language. Skipped when it is already in that language.
    const s = stateRef.current;
    const mayEscalate = sorted ? ESCALATE_TYPES.includes(sorted.type) || sorted.type === 'unclear' : msg.includes('?');
    const sameLang = sorted?.lang ? sorted.lang === s.lang : false;
    const cookText = mayEscalate && !sameLang ? await translate(msg, s.lang) : null;
    apply((st) => customerSends(st, customerId, msg, clock(), sorted, { cookText }));
  }, [apply, clock, sortWithAI, translate]);

  const press = useCallback((orderId, answer) => {
    if (windowRef.current) { playSound('micOff'); windowRef.current = null; } // a tap answers too
    const r = apply((s) => pressButton(s, orderId, answer, clock()));
    commit(bump(stateRef.current, 'buttons', clock()));
    return r;
  }, [apply, clock]);
  const setSpeaker = useCallback((who) => commit(setSpeakingAs(stateRef.current, who)), [commit]);
  const toggleDish = useCallback((itemId) => commit(toggleToday(stateRef.current, itemId)), [commit]);
  const editDish = useCallback((id, patch) => commit(updateItem(stateRef.current, id, patch)), [commit]);
  const addDish = useCallback(() => commit(addItem(stateRef.current)), [commit]);
  const removeDish = useCallback((id) => commit(removeItem(stateRef.current, id)), [commit]);
  const setHour = useCallback((which, hhmm) => commit(setHours(stateRef.current, which, hhmm)), [commit]);
  const ruko = useCallback(() => { queueRef.current = []; stopSpeaking(); }, []);
  // STOP: Nirhast stops talking AND the mic goes off. LISTEN turns the mic back on.
  const micStop = useCallback(() => {
    queueRef.current = []; stopSpeaking();
    micOffRef.current = true;
    windowRef.current = null;
    recRef.current?.pause();
    if (!micBrokenRef.current) setMic('paused');
  }, []);
  const micListen = useCallback(() => {
    micOffRef.current = false;
    if (micBrokenRef.current || !recRef.current) return;
    if (!speakingRef.current) { recRef.current.resume(); setMic('listening'); }
  }, []);

  const reset = useCallback(() => {
    queueRef.current = []; stopSpeaking();
    windowRef.current = null; setLine(null); setHeard(null); setPhrase(null);
    commit({ ...createInitialState(stateRef.current.lang), langChosen: true });
  }, [commit]);

  // ---------- speech in ----------
  const startRecognizer = useCallback(async () => {
    const lang = stateRef.current.lang;
    const onText = (t) => handleCookText(t);
    const onInterim = (t) => { lastInterimRef.current = Date.now(); setInterim(t); };
    micBrokenRef.current = false;
    const onState = (st, msg) => {
      if (st !== 'error') return;
      micBrokenRef.current = true;
      if (!speakingRef.current) setMic('error');
      setError(tr('errMic', { msg: msg || 'Mic error' }));
    };
    try {
      if (configRef.current.stt) {
        const rec = new WisprRecognizer({
          onText, onState,
          onError: (m) => setError(tr('errHear', { msg: m })),
          dictionary: () => [...stateRef.current.menu.map((m) => m.name), ...stateRef.current.customers.map((c) => c.name)],
          language: [lang, ...['hi', 'mr', 'en'].filter((l) => l !== lang)],
        });
        await rec.start();
        recRef.current = rec;
        setEngine(configRef.current.stt);
      } else if (browserSpeechAvailable()) {
        const rec = new BrowserRecognizer({ onText, onInterim, onState, lang: LANGS.find((l) => l.id === lang)?.speech || 'hi-IN' });
        rec.start();
        recRef.current = rec;
        setEngine('browser');
      } else {
        setEngine('none');
        setError(tr('noSpeech'));
      }
      if (micOffRef.current && recRef.current) { recRef.current.pause(); if (!micBrokenRef.current) setMic('paused'); } // STOP pressed: stay off (e.g. after a language switch)
      else if (!micBrokenRef.current) setMic(recRef.current ? 'listening' : 'typed');
    } catch (err) {
      micBrokenRef.current = true;
      setMic('error');
      setError(tr('errHear', { msg: err?.message || err }));
      setEngine('none');
    }
  }, [handleCookText, tr]);

  // ---------- start the kitchen (needs a tap so the browser allows mic + audio) ----------
  const start = useCallback(async () => {
    setError(null);
    setStarted(true);
    startedRef.current = true;
    preloadSounds();
    await startRecognizer();
    if (!ttsAvailable() && !configRef.current.sarvam) setError((e) => e || tr('errNoTts'));
    apply((s) => tick(s, clock()));
  }, [startRecognizer, apply, clock, tr]);

  const setLang = useCallback(async (lang) => {
    commit({ ...setLangRule(stateRef.current, safeLang(lang)), langChosen: true });
    if (startedRef.current && recRef.current) { // restart listening in the new language
      recRef.current.stop(); recRef.current = null;
      await startRecognizer();
    }
  }, [commit, startRecognizer]);

  // ---------- history, sync, forecast ----------
  useEffect(() => {
    fetch('api/history?days=35').then((r) => (r.ok ? r.json() : null)).catch(() => null).then((h) => {
      if (h && Array.isArray(h.orders)) setHistory({ ...h, loaded: true });
      else setHistory({ ...sampleHistory(stateRef.current.customers, Date.now()), sample: true, loaded: true, local: true });
    });
  }, []);

  // Send today's orders, feedback and counts to the server's database (a moment after the last change).
  useEffect(() => {
    if (!history.loaded || history.local) return undefined;
    const id = setTimeout(() => {
      const s = stateRef.current;
      fetch('api/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day: dayKey(Date.now()), orders: s.orders, feedback: s.feedback || [], stats: s.stats || null }),
      }).catch(() => { /* offline: the next change tries again */ });
    }, 1500);
    return () => clearTimeout(id);
  }, [state.orders, state.feedback, state.stats, history.loaded, history.local]);

  const today = dayKey(now);
  const forecast = useMemo(
    () => (history.loaded ? makeForecast(history.orders.filter((o) => o.day !== today), state.orders, Date.now()) : null),
    [history, state.orders, today],
  );

  // The short forecast line is also spoken at opening (kitchen.js reads state.forecastLine).
  useEffect(() => {
    if (!forecast) return;
    const lang = stateRef.current.lang;
    const text = forecast.enough
      ? i18nLine(lang, 'forecastLine', { low: forecast.low, high: forecast.high, weekday: WEEKDAYS[lang][forecast.weekday], slot: clockLabel(lang, forecast.busiest) })
      : null;
    if (stateRef.current.forecastLine !== text) commit({ ...stateRef.current, forecastLine: text });
  }, [forecast, state.lang, commit]);

  // ---------- timers ----------
  useEffect(() => {
    fetch('api/config').then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
      .then((c) => {
        const next = { wispr: Boolean(c.wispr), groq: Boolean(c.groq), sarvam: Boolean(c.sarvam), translateFirst: Boolean(c.translateFirst), stt: c.stt || null, checked: true };
        configRef.current = next;
        setConfig(next);
      });
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const t = clock();
      setNow(t);
      // Listening window: nothing heard in 6 s -> engine decides (repeat once, then ladder)
      const w = windowRef.current;
      if (w && !speakingRef.current && Date.now() > w.deadline && Date.now() - lastInterimRef.current > 1500) {
        windowRef.current = null;
        playSound('micOff'); // time to answer ran out
        if (stateRef.current.dialog) apply((s) => noReply(s, clock()));
      }
      if (startedRef.current && !speakingRef.current) {
        const r = tick(stateRef.current, t);
        if (r.effects.length || JSON.stringify(r.state) !== JSON.stringify(stateRef.current)) {
          const prev = stateRef.current;
          commit(r.state);
          runEffects(r.effects, soundCues(prev, r.state, t));
        }
      }
    }, 500);
    return () => clearInterval(id);
  }, [apply, clock, commit, runEffects]);

  useEffect(() => () => { recRef.current?.stop(); stopSpeaking(); }, []);

  return {
    state, now, mic, engine, config, line, heard, interim, phrase, error, notice, started, history, forecast,
    start, handleCookText, sendCustomer, press, setSpeaker, ruko, micStop, micListen, micOff: mic === 'paused', reset, setLang, toggleDish, setHour, editDish, addDish, removeDish,
    listening: Boolean(windowRef.current),
  };
}
