// Small server: serves the built app and, only if WISPR_API_KEY is set,
// forwards recorded audio to the Wispr Flow REST API so the key never reaches the browser.
// With no key the app still starts and uses the browser's own speech recognition.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 8080);
const WISPR_API_KEY = process.env.WISPR_API_KEY || '';
const WISPR_URL = process.env.WISPR_API_URL || 'https://platform-api.wisprflow.ai/api/v1/dash/api';

app.use(express.json({ limit: '30mb' }));

app.get('/api/config', (_req, res) => {
  res.json({ wispr: Boolean(WISPR_API_KEY) });
});

app.post('/api/transcribe', async (req, res) => {
  if (!WISPR_API_KEY) return res.status(503).json({ error: 'no_key', message: 'WISPR_API_KEY is not set on the server.' });
  const { audio, language, dictionary } = req.body || {};
  if (!audio || typeof audio !== 'string') return res.status(400).json({ error: 'bad_request', message: 'audio (base64 16 kHz WAV) is required' });
  try {
    const r = await fetch(WISPR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${WISPR_API_KEY}` },
      body: JSON.stringify({
        audio,
        language: Array.isArray(language) && language.length ? language : ['hi', 'mr', 'en'],
        context: {
          app: { name: 'Nirhast kitchen', type: 'other' },
          dictionary_context: Array.isArray(dictionary) ? dictionary.slice(0, 200) : [],
        },
      }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(502).json({ error: 'wispr_error', status: r.status, message: body?.message || body?.error || 'Wispr Flow request failed' });
    return res.json({ text: body.text || '', language: body.detected_language || null, ms: body.total_time ?? null });
  } catch (err) {
    return res.status(502).json({ error: 'wispr_unreachable', message: String(err?.message || err) });
  }
});

const dist = path.resolve(__dirname, '..', 'dist');
app.use(express.static(dist));
app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));

app.listen(PORT, () => {
  console.log(`Nirhast running on http://localhost:${PORT}`);
  console.log(WISPR_API_KEY ? 'Speech: Wispr Flow API (key set)' : 'Speech: browser speech recognition (no WISPR_API_KEY set)');
});
