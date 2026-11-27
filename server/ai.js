// AI helpers used by the server. Keys stay on the server; the browser never sees them.
//
//  - sortMessage(): Groq LLM gives a message a TYPE (and the details it found). It never writes replies
//    and never decides anything. The rules in src/core decide what happens with that type.
//  - transcribeGroq(): Groq Whisper turns recorded speech into text (used when no Wispr Flow key is set).
//  - speakSarvam(): Sarvam turns the app's fixed reply text into speech. It only reads text aloud.

export const COOK_TYPES = {
  yes: 'agrees / confirms (haan, ho, ok, theek hai, chalega)',
  no: 'refuses / declines (nahi, nako, no)',
  change_number: 'gives a different number, e.g. "2 nahi, 3" or "teen kar do". Put the new number in "number".',
  later: 'wants to be asked later (baad mein, nantar, later)',
  stop: 'tells the app to stop talking right now (ruko, thamba, stop)',
  quiet: 'wants silence for a while (abhi mat bolo, bolu naka, quiet). Put minutes in "minutes" if said.',
  undo: 'says the last action was a mistake (galat, wapas, undo)',
  next_dish: 'asks what to cook next (ab kya banaun, kay banvu)',
  prep_count: 'asks how many thalis/items in total (kitni thali, kiti thali)',
  delivered: 'says an order was delivered. Put the customer name in "name".',
  cancel: 'wants to cancel an order. Put the customer name in "name".',
  refund: 'wants a refund for an order. Put the customer name in "name".',
  price_change: 'changes the price of a menu item. Put "item" (menu id) and "price".',
  menu_set: 'sets today\'s menu, e.g. "aaj dal, aloo gobi, thali 120". Put "dishes" (list) and "price".',
  answer: 'answers the customer question that the app just read out (free text).',
  background: 'talk not meant for the app: TV, family, phone call, noise.',
  unclear: 'meant for the app but you cannot tell what it means.',
};

export const CUSTOMER_TYPES = {
  greeting: 'hi, hello, namaste',
  menu_question: 'asks to see the menu / what is there today (no specific dish)',
  item_question: 'asks whether specific dishes are available today, e.g. "paneer hai aaj?". Put "items" (menu ids asked about) and "other" (names of dishes asked about that are NOT in the menu ids).',
  price_question: 'asks the price of something',
  hours_question: 'asks when the kitchen is open or closes',
  new_order: 'orders food. Put "items" [{"item": menu id, "qty": number or null}], "time" {"hour": 0-23, "minute": 0-59} or null, "notes" from: bina pyaaz, kam teekha.',
  usual_order: 'asks for their usual / regular order (put "time" if given)',
  change_order: 'changes an order already placed. Put "qty" and/or "time".',
  yes: 'says yes to the app\'s last question',
  no: 'says no to the app\'s last question',
  address: 'sends a delivery address',
  question: 'asks something the menu, prices and hours cannot answer (a dish not on the menu, discounts, ingredients, anything else)',
  complaint: 'complains or is unhappy (late, cold, bad food, wrong order)',
  special_request: 'asks for something special (extra item, custom cooking, bulk or party order, change of delivery place)',
  payment: 'talks about payment, bill, UPI, refund, money',
  thanks: 'just says thanks / ok / bye',
  unclear: 'you cannot tell what they want',
};

// `english` (optional): a machine translation of the message. The model sees both; the original wins.
export function buildSortPrompt(role, text, ctx = {}, english = null) {
  const types = role === 'cook' ? COOK_TYPES : CUSTOMER_TYPES;
  const menu = (ctx.menu || []).map((m) => `${m.id} (${(m.names || []).join(', ')})`).join('; ');
  const people = (ctx.customers || []).join(', ');
  const who = role === 'cook'
    ? 'You label what a home-kitchen cook in Mumbai said out loud to the kitchen app "Nirhast". Speech-to-text may have mistakes.'
    : 'You label a WhatsApp message a customer sent to a home tiffin kitchen in Mumbai.';
  const open = ctx.question ? `The app's last question was: "${ctx.question}".` : 'The app has not asked anything right now.';
  return [
    who,
    'People mix Hindi, Marathi and English, in Roman or Devanagari script.',
    open,
    `Menu ids: ${menu || 'none'}.`,
    role === 'cook' ? `Customer names: ${people || 'none'}.` : '',
    '',
    'Choose exactly ONE type:',
    ...Object.entries(types).map(([k, v]) => `- ${k}: ${v}`),
    '',
    'Rules:',
    '- Only label. Do not answer the person and do not invent anything.',
    '- Use only menu ids and customer names from the lists above.',
    '- If you are not sure, use "unclear" and a low confidence. Never guess "yes".',
    '- "lang" is the language of the message: "en", "hi" or "mr".',
    '',
    'Reply with JSON only, like {"type": "...", "confidence": 0.0-1.0, "lang": "hi", ...details}.',
    '',
    `Message: """${String(text).slice(0, 500)}"""`,
    english && english.trim() && english.trim() !== String(text).trim()
      ? `English translation (by machine, may be imperfect; if it disagrees with the message, trust the message): """${String(english).slice(0, 500)}"""`
      : null,
  ].filter((l) => l !== null).join('\n');
}

export async function sortMessage({ key, model, role, text, ctx, english = null, fetchImpl = fetch }) {
  const r = await fetchImpl('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: buildSortPrompt(role, text, ctx, english) }],
      response_format: { type: 'json_object' },
      reasoning_effort: 'low',
      include_reasoning: false,
      temperature: 0,
      max_completion_tokens: 800,
    }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(body?.error?.message || `Groq error ${r.status}`);
    err.status = r.status;
    throw err;
  }
  const content = body?.choices?.[0]?.message?.content || '{}';
  const out = JSON.parse(content);
  const types = role === 'cook' ? COOK_TYPES : CUSTOMER_TYPES;
  if (!out || !(out.type in types)) return { type: 'unclear', confidence: 0 };
  return out;
}

export async function transcribeGroq({ key, model, wavBase64, language, prompt, fetchImpl = fetch }) {
  const form = new FormData();
  form.append('file', new Blob([Buffer.from(wavBase64, 'base64')], { type: 'audio/wav' }), 'speech.wav');
  form.append('model', model);
  if (language) form.append('language', language);
  if (prompt) form.append('prompt', prompt.slice(0, 600));
  form.append('response_format', 'json');
  form.append('temperature', '0');
  const r = await fetchImpl('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form,
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(body?.error?.message || `Groq Whisper error ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return { text: body.text || '' };
}

const SARVAM_LANG = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };

export async function speakSarvam({ key, text, lang, speaker, model, fetchImpl = fetch }) {
  const r = await fetchImpl('https://api.sarvam.ai/text-to-speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-subscription-key': key },
    body: JSON.stringify({
      text: String(text).slice(0, 2500),
      language_code: SARVAM_LANG[lang] || 'hi-IN',
      model,
      speaker,
      pace: 1.0,
      speech_sample_rate: 22050,
      output_audio_codec: 'wav',
    }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(body?.error?.message || `Sarvam error ${r.status}`);
    err.status = r.status;
    throw err;
  }
  const audio = body?.audios?.[0];
  if (!audio) throw new Error('Sarvam returned no audio');
  return { audio, mime: 'audio/wav' };
}

// Sarvam text translation (mayura:v1 detects the source language itself and handles mixed Hindi/Marathi/English).
export async function translateSarvam({ key, text, to, fetchImpl = fetch }) {
  const r = await fetchImpl('https://api.sarvam.ai/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-subscription-key': key },
    body: JSON.stringify({
      input: String(text).slice(0, 1000),
      source_language_code: 'auto',
      target_language_code: SARVAM_LANG[to] || 'en-IN',
      model: 'mayura:v1',
      mode: to === 'en' ? 'formal' : 'modern-colloquial',
      numerals_format: 'international',
    }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(body?.error?.message || `Sarvam translate error ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return { text: body.translated_text || '', from: body.source_language_code || null };
}
