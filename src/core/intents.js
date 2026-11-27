// Turns an AI label ("type") into the plain words the rules already understand.
// The AI only labels; the same tested rules then decide what happens.
// Anything doubtful (low confidence, unknown name or dish, odd number) falls back to the raw text,
// so the rules treat it exactly as they would without AI.

export const MIN_CONFIDENCE = 0.6;
export const ESCALATE_TYPES = ['question', 'complaint', 'special_request', 'payment'];

const okNum = (n, max = 100) => Number.isInteger(n) && n > 0 && n <= max;
// A complaint is trusted at lower confidence: it is safer to show the owner one complaint too many than to miss one.
const sure = (s) => s && typeof s.type === 'string' && (s.confidence ?? 1) >= (s.type === 'complaint' ? 0.4 : MIN_CONFIDENCE);

function knownName(state, name) {
  if (!name) return null;
  const n = String(name).toLowerCase();
  return state.customers.find((c) => n.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(n))?.name || null;
}
function menuItem(state, id) {
  return state.menu.find((m) => m.id === id) || null;
}
// 24h time -> words parseTime() reads back to the same hour
export function timeWords(t) {
  if (!t || !Number.isInteger(t.hour) || t.hour < 0 || t.hour > 23) return '';
  const m = Number.isInteger(t.minute) && t.minute > 0 && t.minute < 60 ? t.minute : 0;
  const h12 = ((t.hour + 11) % 12) + 1;
  const part = t.hour < 12 ? 'subah' : t.hour < 17 ? 'dopahar' : 'raat';
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''} baje ${part}`;
}

// Cook speech. Returns rule text, or null to use the raw words.
export function cookRuleText(sorted, state) {
  if (!sure(sorted)) return null;
  const s = sorted;
  switch (s.type) {
    case 'yes': return 'haan';
    case 'no': return 'nahi';
    case 'change_number': return okNum(s.number) ? `nahi ${s.number}` : null;
    case 'later': return 'baad mein';
    case 'stop': return 'ruko';
    case 'quiet': return okNum(s.minutes, 120) ? `abhi mat bolo ${s.minutes} minute` : 'abhi mat bolo';
    case 'undo': return 'galat wapas';
    case 'next_dish': return 'ab kya banaun';
    case 'prep_count': return 'kitni thali';
    case 'delivered': { const n = knownName(state, s.name); return n ? `${n} delivered` : null; }
    case 'cancel': { const n = knownName(state, s.name); return n ? `${n} ka order cancel` : null; }
    case 'refund': { const n = knownName(state, s.name); return n ? `${n} refund` : null; }
    case 'price_change': {
      const m = menuItem(state, s.item);
      return m && okNum(s.price, 5000) ? `${m.synonyms[0]} price badlo ${s.price}` : null;
    }
    case 'menu_set': {
      const dishes = Array.isArray(s.dishes) ? s.dishes.filter((d) => typeof d === 'string' && d.trim()).slice(0, 5) : [];
      return dishes.length && okNum(s.price, 5000) ? `aaj ${dishes.join(' aur ')} thali ${s.price}` : null;
    }
    default: return null; // answer, unclear: the raw words go to the rules
  }
}

// Customer message. Returns { ruleText } or { escalate: type } or { thanks: true } or null (use raw words).
export function customerRuleText(sorted, state) {
  if (!sure(sorted)) return null;
  const s = sorted;
  if (ESCALATE_TYPES.includes(s.type)) return { escalate: s.type };
  switch (s.type) {
    case 'thanks': return { thanks: true };
    case 'praise': return { feedback: 'praise' };
    case 'suggestion': return { feedback: 'suggestion' };
    case 'off_topic': return { offTopic: true };
    case 'item_question': {
      const items = (Array.isArray(s.items) ? s.items : []).map((i) => (typeof i === 'string' ? i : i?.item)).filter((id) => menuItem(state, id));
      const other = [].concat(s.other || []).filter((x) => typeof x === 'string' && x.trim()).slice(0, 3);
      return items.length || other.length ? { itemQuestion: { items, other } } : { ruleText: 'menu' };
    }
    case 'greeting': return { ruleText: 'hi' };
    case 'menu_question':
    case 'price_question': return { ruleText: 'menu' };
    case 'hours_question': return { ruleText: 'kab tak khula hai' };
    case 'usual_order': return { ruleText: `usual ${timeWords(s.time)}`.trim() };
    case 'yes': return { ruleText: 'haan' };
    case 'no': return { ruleText: 'nahi' };
    case 'new_order': {
      const items = (Array.isArray(s.items) ? s.items : []).map((i) => ({ m: menuItem(state, i?.item), qty: i?.qty })).filter((i) => i.m);
      if (!items.length) return null;
      const parts = items.map((i) => (okNum(i.qty) ? `${i.qty} ${i.m.synonyms[0]}` : i.m.synonyms[0]));
      const notes = [].concat(s.notes || []).filter((n) => ['bina pyaaz', 'kam teekha'].includes(n));
      return { ruleText: [parts.join(' aur '), timeWords(s.time), ...notes].filter(Boolean).join(' ') };
    }
    case 'change_order': {
      if (!okNum(s.qty)) return null;
      return { ruleText: [`${s.qty} thali kar do`, timeWords(s.time)].filter(Boolean).join(' ') };
    }
    default: return null; // address, unclear: raw words
  }
}
