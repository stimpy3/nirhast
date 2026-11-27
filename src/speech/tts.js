// Speech out. Sarvam (through our server) when its key is set, otherwise the browser's built-in voice.
// Sarvam only reads the given text aloud; it decides nothing.
import { LANGS } from '../core/i18n.js';

const speechTag = (lang) => LANGS.find((l) => l.id === lang)?.speech || 'hi-IN';

function pickVoice(lang) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const tag = speechTag(lang);
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === tag) || voices.find((v) => v.lang?.startsWith(tag.slice(0, 2)))
    || (lang === 'mr' ? voices.find((v) => v.lang === 'hi-IN') : null) || voices.find((v) => v.lang === 'en-IN') || null;
}
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

export function ttsAvailable() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

let audioEl = null;
const audioCache = new Map(); // same line twice: no second request

function speakBrowser(text, lang) {
  return new Promise((resolve) => {
    if (!ttsAvailable()) { resolve(); return; }
    const u = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(lang);
    u.lang = voice?.lang || speechTag(lang);
    if (voice) u.voice = voice;
    u.rate = 0.95;
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    u.onend = finish;
    u.onerror = finish;
    setTimeout(finish, 1500 + text.length * 90); // some browsers never fire onend
    window.speechSynthesis.speak(u);
  });
}

async function sarvamAudio(text, lang) {
  const key = `${lang}|${text}`;
  if (audioCache.has(key)) return audioCache.get(key);
  const r = await fetch('api/speak', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, lang }) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body.audio) throw new Error(body?.message || `voice error ${r.status}`);
  const src = `data:${body.mime || 'audio/wav'};base64,${body.audio}`;
  audioCache.set(key, src);
  if (audioCache.size > 100) audioCache.delete(audioCache.keys().next().value);
  return src;
}

// Returns a promise that resolves when speaking ends. onFallback(msg) is called if Sarvam fails.
export async function speak(text, { lang = 'en', sarvam = false, onFallback } = {}) {
  if (sarvam) {
    try {
      const src = await sarvamAudio(text, lang);
      await new Promise((resolve) => {
        audioEl = new Audio(src);
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        audioEl.onended = finish;
        audioEl.onerror = finish;
        audioEl.onpause = finish;
        setTimeout(finish, 4000 + text.length * 150);
        audioEl.play().catch(finish);
      });
      return;
    } catch (err) {
      onFallback?.(String(err?.message || err));
    }
  }
  await speakBrowser(text, lang);
}

export function stopSpeaking() {
  if (audioEl) { try { audioEl.pause(); } catch { /* noop */ } audioEl = null; }
  if (ttsAvailable()) window.speechSynthesis.cancel();
}

// A soft chime that marks the end of a question (the listening window starts).
export function chime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = chime.ctx || (chime.ctx = new Ctx());
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.4);
  } catch { /* no audio: the screen still shows the state */ }
}
