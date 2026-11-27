// Speech in. Two engines behind one interface:
//   onText(text)        final transcript
//   onInterim(text)     partial transcript (browser engine only)
//   onState(state)      'listening' | 'paused' | 'error' | 'off'
//   start() / stop() / pause() / resume() / setEndSilence(ms)
//
// 1. WisprRecognizer  — records 16 kHz WAV segments with a simple voice-activity
//    detector and sends them to /api/transcribe. The server sends them to Wispr Flow,
//    or to Groq Whisper when only a Groq key is set. Keys never reach the browser.
// 2. BrowserRecognizer — the browser's built-in SpeechRecognition (Chrome/Edge), used
//    when no speech key is configured. The UI always says which one is active.

export function browserSpeechAvailable() {
  return typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export class BrowserRecognizer {
  constructor({ onText, onInterim, onState, lang = 'hi-IN' }) {
    this.name = 'browser';
    this.onText = onText; this.onInterim = onInterim || (() => {}); this.onState = onState || (() => {});
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.rec = new SR();
    this.rec.lang = lang;
    this.rec.continuous = true;
    this.rec.interimResults = true;
    this.active = false; this.paused = false;
    this.rec.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        const t = r[0].transcript.trim();
        if (!t) continue;
        if (r.isFinal) this.onText(t); else this.onInterim(t);
      }
    };
    this.rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { this.active = false; this.onState('error', 'Mic permission denied'); }
    };
    this.rec.onend = () => {
      // Chrome stops after silence; keep listening while active and not paused
      if (this.active && !this.paused) { try { this.rec.start(); } catch { /* already started */ } }
    };
  }
  setEndSilence() { /* the browser decides when a phrase ends */ }
  start() { this.active = true; this.paused = false; try { this.rec.start(); } catch { /* noop */ } this.onState('listening'); }
  stop() { this.active = false; try { this.rec.abort(); } catch { /* noop */ } this.onState('off'); }
  pause() { this.paused = true; try { this.rec.abort(); } catch { /* noop */ } this.onState('paused'); }
  resume() { if (!this.active) return; this.paused = false; try { this.rec.start(); } catch { /* noop */ } this.onState('listening'); }
}

export class WisprRecognizer {
  constructor({ onText, onState, onError, dictionary = () => [], language = ['hi', 'mr', 'en'] }) {
    this.name = 'server';
    this.language = language;
    this.onText = onText; this.onState = onState || (() => {}); this.onError = onError || (() => {});
    this.dictionary = dictionary;
    this.endSilenceMs = 1000;
    this.active = false; this.paused = false;
  }
  setEndSilence(ms) { this.endSilenceMs = ms; }
  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true } });
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.proc = this.ctx.createScriptProcessor(2048, 1, 1);
    this.sampleRate = this.ctx.sampleRate;
    this.noise = 0.005; this.inSpeech = false; this.buf = []; this.pre = []; this.silentMs = 0; this.speechMs = 0;
    const frameMs = (2048 / this.sampleRate) * 1000;
    this.proc.onaudioprocess = (e) => {
      if (!this.active || this.paused) return;
      const data = new Float32Array(e.inputBuffer.getChannelData(0));
      let sum = 0; for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / data.length);
      const threshold = Math.max(0.012, this.noise * 3);
      if (!this.inSpeech) {
        this.noise = this.noise * 0.95 + rms * 0.05; // track background noise
        this.pre.push(data); if (this.pre.length > 6) this.pre.shift(); // ~250 ms pre-roll
        if (rms > threshold) { this.inSpeech = true; this.buf = [...this.pre]; this.silentMs = 0; this.speechMs = 0; }
      } else {
        this.buf.push(data);
        this.speechMs += frameMs;
        this.silentMs = rms > threshold ? 0 : this.silentMs + frameMs;
        if (this.silentMs >= this.endSilenceMs || this.speechMs > 10000) this.flush();
      }
    };
    src.connect(this.proc);
    this.proc.connect(this.ctx.destination);
    this.active = true; this.paused = false;
    this.onState('listening');
  }
  async flush() {
    const chunks = this.buf; this.buf = []; this.inSpeech = false;
    if (this.speechMs < 250) return; // too short: a clatter, not speech
    const wav = encodeWav16k(chunks, this.sampleRate);
    try {
      const r = await fetch('api/transcribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: wav, language: this.language, dictionary: this.dictionary() }),
      });
      const body = await r.json();
      if (!r.ok) { this.onError(body?.message || 'Speech-to-text request failed'); return; }
      if (body.text && body.text.trim()) this.onText(body.text.trim());
    } catch (err) {
      this.onError(String(err?.message || err));
    }
  }
  stop() { this.active = false; try { this.proc?.disconnect(); this.stream?.getTracks().forEach((t) => t.stop()); this.ctx?.close(); } catch { /* noop */ } this.onState('off'); }
  pause() { this.paused = true; this.buf = []; this.inSpeech = false; this.onState('paused'); }
  resume() { if (!this.active) return; this.paused = false; this.onState('listening'); }
}

// Float32 chunks at any rate -> base64 16 kHz 16-bit mono WAV (what Wispr Flow expects).
export function encodeWav16k(chunks, inRate) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const input = new Float32Array(total);
  let off = 0; for (const c of chunks) { input.set(c, off); off += c.length; }
  const outRate = 16000;
  const ratio = inRate / outRate;
  const outLen = Math.floor(input.length / ratio);
  const pcm = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio; const i0 = Math.floor(pos); const i1 = Math.min(i0 + 1, input.length - 1);
    const v = input[i0] + (input[i1] - input[i0]) * (pos - i0);
    pcm[i] = Math.max(-1, Math.min(1, v)) * 0x7fff;
  }
  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); view.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, outRate, true); view.setUint32(28, outRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  w(36, 'data'); view.setUint32(40, pcm.length * 2, true);
  new Int16Array(buffer, 44).set(pcm);
  let bin = ''; const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
