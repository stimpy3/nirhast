// Small server: serves the built app and talks to outside AI services only when their keys are set.
// Keys come from environment variables or a local .env file (never committed).
// With no keys the app still starts: browser speech in, browser voice out, word rules for understanding.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sortMessage, transcribeGroq, speakSarvam, translateSarvam } from './ai.js';
import { openDb, seedSample } from './db.js';
import { dayKey } from '../src/core/history.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.resolve(__dirname, '..', '.env')); } catch { /* no .env file: fine */ }

const env = (...names) => names.map((n) => process.env[n]).find((v) => v && v.trim())?.trim() || '';
const PORT = Number(process.env.PORT || 8080);
const WISPR_API_KEY = env('WISPR_API_KEY');
const WISPR_URL = env('WISPR_API_URL') || 'https://platform-api.wisprflow.ai/api/v1/dash/api';
const GROQ_API_KEY = env('GROQ_API_KEY', 'GROK_API_KEY', 'GROQ_KEY');
const SARVAM_API_KEY = env('SARVAM_API_KEY', 'SARVAAM_API_KEY', 'SARVAM_KEY');
const MODELS = {
  cook: env('GROQ_COOK_MODEL') || 'openai/gpt-oss-20b', // short replies, needs speed
  customer: env('GROQ_CHAT_MODEL') || 'openai/gpt-oss-120b', // longer messages, more types
  stt: env('GROQ_STT_MODEL') || 'whisper-large-v3',
};
const SARVAM = { model: env('SARVAM_MODEL') || 'bulbul:v3', speaker: env('SARVAM_SPEAKER') || 'priya' };
// Translate messages to English before the AI sorts them (needs SARVAM_API_KEY). TRANSLATE_BEFORE_SORT=false switches it off.
const TRANSLATE_FIRST = env('TRANSLATE_BEFORE_SORT').toLowerCase() !== 'false';

const app = express();
app.use(express.json({ limit: '30mb' }));

const stt = WISPR_API_KEY ? 'wispr' : GROQ_API_KEY ? 'groq' : null;
app.get('/api/config', (_req, res) => {
  res.json({ wispr: Boolean(WISPR_API_KEY), groq: Boolean(GROQ_API_KEY), sarvam: Boolean(SARVAM_API_KEY), translateFirst: Boolean(SARVAM_API_KEY) && TRANSLATE_FIRST, stt });
});

// Speech in: Wispr Flow if its key is set, otherwise Groq Whisper.
app.post('/api/transcribe', async (req, res) => {
  if (!stt) return res.status(503).json({ error: 'no_key', message: 'No speech-to-text key is set on the server.' });
  const { audio, language, dictionary } = req.body || {};
  if (!audio || typeof audio !== 'string') return res.status(400).json({ error: 'bad_request', message: 'audio (base64 16 kHz WAV) is required' });
  const langs = Array.isArray(language) && language.length ? language : ['hi', 'mr', 'en'];
  const words = Array.isArray(dictionary) ? dictionary.slice(0, 200) : [];
  try {
    if (stt === 'groq') {
      const out = await transcribeGroq({ key: GROQ_API_KEY, model: MODELS.stt, wavBase64: audio, language: langs[0], prompt: words.join(', ') });
      return res.json({ text: out.text, engine: 'groq' });
    }
    const r = await fetch(WISPR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${WISPR_API_KEY}` },
      body: JSON.stringify({ audio, language: langs, context: { app: { name: 'Nirhast kitchen', type: 'other' }, dictionary_context: words } }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(502).json({ error: 'wispr_error', status: r.status, message: body?.message || body?.error || 'Wispr Flow request failed' });
    return res.json({ text: body.text || '', engine: 'wispr' });
  } catch (err) {
    return res.status(err.status === 429 ? 429 : 502).json({ error: 'stt_failed', message: String(err?.message || err) });
  }
});

// Sorting: the LLM labels a message with a type. Rules in the app decide what to do.
app.post('/api/sort', async (req, res) => {
  if (!GROQ_API_KEY) return res.status(503).json({ error: 'no_key', message: 'GROQ_API_KEY is not set on the server.' });
  const { role, text, context, english } = req.body || {};
  if (!['cook', 'customer'].includes(role) || !text) return res.status(400).json({ error: 'bad_request' });
  try {
    const out = await sortMessage({ key: GROQ_API_KEY, model: MODELS[role], role, text, ctx: context || {}, english: typeof english === 'string' ? english : null });
    return res.json(out);
  } catch (err) {
    return res.status(err.status === 429 ? 429 : 502).json({ error: 'sort_failed', message: String(err?.message || err) });
  }
});

// Translation: Sarvam. Same text twice = served from memory, not paid twice.
const translateCache = new Map();
app.post('/api/translate', async (req, res) => {
  if (!SARVAM_API_KEY) return res.status(503).json({ error: 'no_key', message: 'SARVAM_API_KEY is not set on the server.' });
  const { text, to } = req.body || {};
  if (!text || typeof text !== 'string' || !['en', 'hi', 'mr'].includes(to)) return res.status(400).json({ error: 'bad_request' });
  const cacheKey = `${to}|${text}`;
  if (translateCache.has(cacheKey)) return res.json(translateCache.get(cacheKey));
  try {
    const out = await translateSarvam({ key: SARVAM_API_KEY, text, to });
    translateCache.set(cacheKey, out);
    if (translateCache.size > 500) translateCache.delete(translateCache.keys().next().value);
    return res.json(out);
  } catch (err) {
    return res.status(err.status === 429 ? 429 : 502).json({ error: 'translate_failed', message: String(err?.message || err) });
  }
});

// Speech out: Sarvam reads the given text aloud. Same line twice = served from memory, not paid twice.
const voiceCache = new Map();
app.post('/api/speak', async (req, res) => {
  if (!SARVAM_API_KEY) return res.status(503).json({ error: 'no_key', message: 'SARVAM_API_KEY is not set on the server.' });
  const { text, lang } = req.body || {};
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'bad_request' });
  const cacheKey = `${lang}|${text}`;
  if (voiceCache.has(cacheKey)) return res.json(voiceCache.get(cacheKey));
  try {
    const out = await speakSarvam({ key: SARVAM_API_KEY, text, lang, ...SARVAM });
    voiceCache.set(cacheKey, out);
    if (voiceCache.size > 300) voiceCache.delete(voiceCache.keys().next().value);
    return res.json(out);
  } catch (err) {
    return res.status(err.status === 429 ? 429 : 502).json({ error: 'speak_failed', message: String(err?.message || err) });
  }
});

// ---------- the kitchen's database (orders, feedback, daily counts across days) ----------
const DATA_DIR = env('DATA_DIR') || path.resolve(__dirname, '..', 'data');
const SAMPLE_HISTORY = env('SAMPLE_HISTORY').toLowerCase() !== 'false';
const store = await openDb(DATA_DIR);
if (SAMPLE_HISTORY && seedSample(store, Date.now())) console.log('Database:   filled 5 weeks of sample history (SAMPLE_HISTORY=false to skip)');

app.get('/api/history', (req, res) => {
  const days = Math.min(90, Math.max(1, parseInt(req.query.days || '35', 10)));
  const since = dayKey(Date.now() - days * 24 * 3600 * 1000);
  res.json({ ...store.history(since), sample: store.hasSample() });
});

// The kitchen screen sends today's orders, feedback and counts; they replace what is stored for today.
app.post('/api/sync', (req, res) => {
  const { day, orders, feedback, stats } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '')) return res.status(400).json({ error: 'bad_request' });
  try {
    store.replaceDay(day, { orders: Array.isArray(orders) ? orders : [], feedback: Array.isArray(feedback) ? feedback : [], stats: stats || null });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'db_failed', message: String(err?.message || err) });
  }
});

const dist = path.resolve(__dirname, '..', 'dist');
app.use(express.static(dist));
app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));

app.listen(PORT, () => {
  console.log(`Nirhast running on http://localhost:${PORT}`);
  console.log(`Speech in:  ${stt === 'wispr' ? 'Wispr Flow API' : stt === 'groq' ? `Groq Whisper (${MODELS.stt})` : 'browser speech recognition (no key set)'}`);
  console.log(`Sorting:    ${GROQ_API_KEY ? `Groq (cook: ${MODELS.cook}, chat: ${MODELS.customer})` : 'word rules only (no GROQ_API_KEY)'}`);
  console.log(`Voice out:  ${SARVAM_API_KEY ? `Sarvam (${SARVAM.model}, ${SARVAM.speaker})` : 'browser voice (no SARVAM_API_KEY)'}`);
  console.log(`Database:   ${store.kind} in ${DATA_DIR}${store.hasSample() ? ' (with sample history)' : ''}`);
  console.log(`Translate:  ${SARVAM_API_KEY ? `Sarvam mayura:v1${TRANSLATE_FIRST ? ' (also before sorting)' : ' (customer-cook text only)'}` : 'off (no SARVAM_API_KEY)'}`);
});
