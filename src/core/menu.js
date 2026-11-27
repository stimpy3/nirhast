// The owner's menu rows are the single source of truth for every menu answer.
// Each row: { id, name, price, stock (null = no limit), today (false = not today), names?, synonyms? }.
import { normalize } from './text.js';

const BOOKED = ['awaiting', 'pending', 'confirmed', 'delivered'];

// Every way a dish can be named: owner's name, translations, spoken synonyms.
export function allNames(m) {
  return [...new Set([m.name, ...Object.values(m.names || {}), ...(m.synonyms || [])]
    .filter((x) => x && String(x).trim()).map((x) => String(x).toLowerCase()))];
}

export function booked(state, itemId) {
  return state.orders.filter((o) => BOOKED.includes(o.status))
    .reduce((sum, o) => sum + o.items.filter((i) => i.itemId === itemId).reduce((x, i) => x + (i.qty || 0), 0), 0);
}

// How many are left today, or null when there is no limit.
export function leftOf(state, m) {
  if (m.stock === null || m.stock === undefined || m.stock === '') return null;
  return Math.max(0, Number(m.stock) - booked(state, m.id));
}

export function available(state, m) {
  if (!m || m.today === false) return false;
  const left = leftOf(state, m);
  return left === null || left > 0;
}

// ---- owner edits (pure) ----
export function updateItem(prev, id, patch) {
  const menu = prev.menu.map((m) => {
    if (m.id !== id) return m;
    const next = { ...m, ...patch };
    if ('stock' in patch) next.today = patch.stock !== 0; // 0 available = not today
    if ('name' in patch) next.names = undefined; // translations no longer match a renamed dish
    return next;
  });
  return { ...prev, menu, menuSetOn: new Date().toDateString() };
}

export function addItem(prev) {
  const id = `item${Date.now().toString(36)}`;
  return { ...prev, menu: [...prev.menu, { id, name: '', price: 0, stock: null, today: true, synonyms: [] }] };
}

export function removeItem(prev, id) {
  return { ...prev, menu: prev.menu.filter((m) => m.id !== id) };
}

// ---- dishes asked about that are not on the menu ("paneer hai aaj?") ----
const ASK_PATTERNS = ['hai aaj', 'hai kya', 'milega', 'milegi', 'milenge', 'available', 'aahe ka', 'ahe ka', 'milel ka',
  'do you have', 'is there', 'है क्या', 'मिलेगा', 'मिलेगी', 'आहे का', 'मिळेल का'];
const STOP = new Set(['hai', 'he', 'aaj', 'kya', 'milega', 'milegi', 'milenge', 'available', 'today', 'do', 'you', 'have', 'is',
  'there', 'any', 'aahe', 'ahe', 'ka', 'ki', 'ke', 'milel', 'bhai', 'bhaiya', 'sir', 'ji', 'please', 'plz', 'kal', 'abhi',
  'hain', 'the', 'a', 'an', 'menu', 'dikhaiye', 'dikhao', 'bhejo', 'and', 'aur', 'or', 'kuch', 'hello', 'hi', 'namaste',
  'है', 'आज', 'क्या', 'मिलेगा', 'मिलेगी', 'आहे', 'का', 'मिळेल', 'मेनू', 'और', 'आणि']);

export function looksLikeAvailabilityQuestion(text) {
  const n = ` ${normalize(text)} `;
  return ASK_PATTERNS.some((p) => n.includes(` ${normalize(p)} `));
}

// Words left after removing question words: the dish the customer asked about. Only used for short questions.
export function unknownDish(state, text) {
  if (!looksLikeAvailabilityQuestion(text)) return null;
  const known = new Set(state.menu.flatMap((m) => allNames(m).flatMap((x) => normalize(x).split(' '))));
  const words = normalize(text).split(' ').filter((w) => w && !STOP.has(w) && !/^\d+$/.test(w) && !known.has(w));
  if (!words.length || words.length > 3) return null;
  return words.join(' ');
}
