// Speech out: the browser's built-in text-to-speech (no key needed).
import { speakable } from '../core/text.js';

let voice = null;
function pickVoice() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  voice = voices.find((v) => v.lang === 'hi-IN') || voices.find((v) => v.lang?.startsWith('hi')) || voices.find((v) => v.lang === 'en-IN') || null;
  return voice;
}
if (typeof window !== 'undefined' && window.speechSynthesis) {
  pickVoice();
  window.speechSynthesis.onvoiceschanged = pickVoice;
}

export function ttsAvailable() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text) {
  return new Promise((resolve) => {
    if (!ttsAvailable()) { resolve(); return; }
    const u = new SpeechSynthesisUtterance(speakable(text));
    u.lang = voice?.lang || 'hi-IN';
    if (voice) u.voice = voice;
    u.rate = 0.95;
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    u.onend = finish;
    u.onerror = finish;
    // Safety net: some browsers never fire onend
    setTimeout(finish, 1500 + text.length * 90);
    window.speechSynthesis.speak(u);
  });
}

export function stopSpeaking() {
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
