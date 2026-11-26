// Text rules for mixed Hindi / Marathi / English speech and chat.
// Speech engines may return Roman script ("haan") or Devanagari ("हाँ"),
// so every word list below carries both.

const DEVANAGARI_DIGITS = { '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9' };

export function normalize(text) {
  if (!text) return '';
  let t = String(text).toLowerCase();
  t = t.replace(/[०-९]/g, (d) => DEVANAGARI_DIGITS[d]);
  t = t.replace(/[।॥]/g, ' '); // Devanagari full stops
  t = t.replace(/[.,!?;:"'()\[\]{}…।\-–—_/\\]/g, ' ');
  return t.replace(/\s+/g, ' ').trim();
}

export function tokens(text) {
  const n = normalize(text);
  return n ? n.split(' ') : [];
}

// Number words. Values are what the cook or customer means.
const NUMBER_WORDS = {
  // English
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30,
  // Hindi (Roman)
  ek: 1, do: 2, teen: 3, tin: 3, char: 4, chaar: 4, paanch: 5, panch: 5, paach: 5, chhe: 6, chhah: 6, che: 6, chah: 6,
  saat: 7, sat: 7, aath: 8, ath: 8, nau: 9, das: 10, dus: 10, gyarah: 11, barah: 12, pandrah: 15, bees: 20, bis: 20,
  pachees: 25, tees: 30,
  // Marathi (Roman)
  don: 2, saha: 6, daha: 10,
  // Hindi / Marathi (Devanagari)
  'एक': 1, 'दो': 2, 'दोन': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5, 'पाच': 5, 'छह': 6, 'छः': 6, 'छे': 6, 'सहा': 6,
  'सात': 7, 'आठ': 8, 'नौ': 9, 'नऊ': 9, 'दस': 10, 'दहा': 10, 'ग्यारह': 11, 'बारह': 12, 'पंद्रह': 15, 'बीस': 20, 'तीस': 30,
};

// Words that look like numbers but usually are not, depending on context.
// "do" also means "give" in Hindi ("bhej do", "kar do"), so it only counts
// when it is not right after a verb.
const DO_VERBS = new Set(['bhej', 'kar', 'de', 'rakh', 'likh', 'bata', 'band', 'chala']);

export function extractNumbers(text) {
  const out = [];
  const tk = tokens(text);
  tk.forEach((w, i) => {
    if (/^\d+$/.test(w)) { out.push({ value: parseInt(w, 10), index: i }); return; }
    const m = w.match(/^(\d+)([a-zऀ-ॿ]+)$/); // "2thali"
    if (m) { out.push({ value: parseInt(m[1], 10), index: i }); return; }
    if (w in NUMBER_WORDS) {
      if (w === 'do' && i > 0 && DO_VERBS.has(tk[i - 1])) return;
      out.push({ value: NUMBER_WORDS[w], index: i });
    }
  });
  return out;
}

// Classification examples, not a closed list: these are the starting set.
export const YES_WORDS = [
  'haan', 'han', 'haa', 'ha', 'hanji', 'haanji', 'ho', 'hoy', 'hao', 'theek', 'thik', 'chalega', 'chalel',
  'yes', 'yeah', 'ok', 'okay', 'okk', 'sahi', 'bilkul', 'done', 'confirm', 'pakka',
  'हाँ', 'हां', 'हा', 'हो', 'होय', 'ठीक', 'चलेगा', 'चालेल', 'सही', 'बिल्कुल', 'बिलकुल', 'येस', 'ओके', 'पक्का',
];
export const NO_WORDS = [
  'nahi', 'nahin', 'nai', 'nahi', 'na', 'nako', 'no', 'nope', 'mat', 'cancel',
  'नहीं', 'नही', 'ना', 'नको', 'नो', 'मत',
];
const LATER_PHRASES = ['baad mein', 'baad me', 'bad me', 'baadme', 'thodi der', 'later', 'नंतर', 'बाद में', 'बाद मे', 'nantar'];

const YES_SET = new Set(YES_WORDS);
const NO_SET = new Set(NO_WORDS);

function hasPhrase(text, list) {
  const n = ` ${normalize(text)} `;
  return list.some((p) => n.includes(` ${p} `));
}

// Classify a reply to a yes/no question.
// Returns { kind: 'yes' | 'no' | 'later' | 'correction' | 'unclear', value? }
// Rules decide; nothing outside these rules is ever treated as "yes".
export function classifyReply(text) {
  const tk = tokens(text);
  if (tk.length === 0) return { kind: 'unclear' };
  if (hasPhrase(text, LATER_PHRASES)) return { kind: 'later' };

  const noIdx = tk.findIndex((w) => NO_SET.has(w));
  const nums = extractNumbers(text);
  // "2 nahi, 3" / "nahi, teen thali" / "do nahi teen" -> correction to the number after "nahi"
  if (noIdx >= 0) {
    const after = nums.filter((n) => n.index > noIdx);
    if (after.length > 0) return { kind: 'correction', value: after[after.length - 1].value };
  }
  // "3 kar do" / "teen" alone while confirming a quantity -> correction too
  const hasYes = tk.some((w) => YES_SET.has(w));
  const hasNo = noIdx >= 0;
  if (!hasYes && !hasNo && nums.length === 1 && tk.length <= 4) {
    return { kind: 'correction', value: nums[0].value };
  }
  if (hasYes && !hasNo) return { kind: 'yes' };
  if (hasNo && !hasYes) return { kind: 'no' };
  return { kind: 'unclear' };
}

// Spoken numbers: words for the voice, digits for the screen.
const HINDI_NUMBER_NAMES = ['shunya', 'ek', 'do', 'teen', 'chaar', 'paanch', 'chhe', 'saat', 'aath', 'nau', 'das',
  'gyaarah', 'baarah', 'terah', 'chaudah', 'pandrah', 'solah', 'satrah', 'athaarah', 'unnees', 'bees'];
export function numberToHindi(n) {
  if (n >= 0 && n < HINDI_NUMBER_NAMES.length) return HINDI_NUMBER_NAMES[n];
  return String(n);
}

// Replace digits in a line with Hindi words so text-to-speech reads them naturally.
export function speakable(line) {
  return line.replace(/\b(\d{1,2})\b/g, (m) => numberToHindi(parseInt(m, 10)));
}

// Times like "1 baje", "1:30 baje", "1 pm", "raat 8 baje", "1 वाजता".
export function parseTime(text) {
  const n = normalize(text);
  const m = n.match(/(\d{1,2})(?:\s*:\s*(\d{2}))?\s*(baje|bje|baja|pm|am|vajta|वाजता|बजे|o clock|oclock)/);
  let hour; let minute = 0; let marker = '';
  if (m) {
    hour = parseInt(m[1], 10); minute = m[2] ? parseInt(m[2], 10) : 0; marker = m[3];
  } else {
    // "baje" after a number word: "ek baje"
    const tk = n.split(' ');
    const i = tk.findIndex((w) => ['baje', 'bje', 'बजे', 'vajta', 'वाजता'].includes(w));
    if (i > 0) {
      const nums = extractNumbers(tk.slice(i - 1, i).join(' '));
      if (nums.length) hour = nums[0].value;
    }
  }
  if (hour === undefined || hour < 1 || hour > 23 || minute > 59) return null;
  const evening = /(raat|shaam|sham|dopahar|dopeher|pm|रात|शाम|दोपहर|संध्याकाळ)/.test(n) || marker === 'pm';
  const morning = /(subah|savere|सुबह|सकाळ|sakali)/.test(n) || marker === 'am';
  let h24 = hour;
  if (hour <= 12) {
    if (morning) h24 = hour === 12 ? 0 : hour;
    else if (evening) h24 = hour === 12 ? 12 : hour + 12;
    else if (hour >= 1 && hour <= 6) h24 = hour + 12; // tiffin lunch/dinner hours
    else if (hour >= 7 && hour <= 10) h24 = hour + 12; // dinner by default; say "subah" for morning
    else h24 = hour; // 11, 12
  }
  return { hour: h24, minute, label: formatTimeLabel(h24, minute) };
}

export function formatTimeLabel(h24, minute = 0) {
  const h12 = ((h24 + 11) % 12) + 1;
  return minute ? `${h12}:${String(minute).padStart(2, '0')} baje` : `${h12} baje`;
}

export function includesAny(text, list) {
  return hasPhrase(text, list.map((p) => normalize(p)));
}
