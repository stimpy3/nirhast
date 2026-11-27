// Numbers behind the Analytics page. Pure: history (past days) + today's state -> chart data.
import { dayKey, dayStart } from './history.js';
import { SAVED_SECONDS } from './metrics.js';

const DAY = 24 * 3600 * 1000;
const BOOKED = ['awaiting', 'pending', 'confirmed', 'delivered'];
const thaliOf = (o) => o.items.filter((i) => i.itemId === 'thali').reduce((s, i) => s + (i.qty || 0), 0);

export const SLOTS = (() => { const out = []; for (let h = 11; h <= 21; h++) for (const m of [0, 30]) out.push({ hour: h, minute: m }); return out; })();
const slotKey = (p) => `${p.hour}:${p.minute >= 30 ? 30 : 0}`;

// Today's orders from the live state, in the same shape as history rows.
export function todayRows(state, now) {
  const day = dayKey(now);
  return state.orders.filter((o) => BOOKED.includes(o.status)).map((o) => ({ ...o, day }));
}

export function buildAnalytics(history, state, now) {
  const today = dayStart(now);
  const todayKey = dayKey(now);
  const past = history.orders.filter((o) => o.day !== todayKey && BOOKED.includes(o.status));
  const all = [...past, ...todayRows(state, now)];
  const byDay = (rows) => { const m = new Map(); for (const o of rows) m.set(o.day, [...(m.get(o.day) || []), o]); return m; };
  const days = byDay(all);

  // Orders per half hour: today vs a typical day for this weekday (average of the last 4)
  const wd = new Date(today).getDay();
  const sameDays = [1, 2, 3, 4].map((w) => dayKey(today - w * 7 * DAY)).filter((d) => days.has(d));
  const count = (rows) => { const m = {}; for (const o of rows) if (o.promised) m[slotKey(o.promised)] = (m[slotKey(o.promised)] || 0) + thaliOf(o); return m; };
  const todayC = count(days.get(todayKey) || []);
  const typC = sameDays.map((d) => count(days.get(d)));
  const slots = SLOTS.map((s) => {
    const k = slotKey(s);
    return { ...s, today: todayC[k] || 0, typical: typC.length ? Math.round(typC.reduce((a, c) => a + (c[k] || 0), 0) / typC.length * 10) / 10 : 0 };
  }).filter((s) => s.today || s.typical);

  // Last 28 days: thalis per day
  const perDay = [];
  for (let b = 27; b >= 0; b--) {
    const d = dayKey(today - b * DAY);
    perDay.push({ day: d, weekday: new Date(today - b * DAY).getDay(), thali: (days.get(d) || []).reduce((s, o) => s + thaliOf(o), 0), today: b === 0 });
  }

  // Top dishes in the last 7 days (today included)
  const dish = {};
  for (let b = 6; b >= 0; b--) for (const o of days.get(dayKey(today - b * DAY)) || []) for (const i of o.items) dish[i.itemId] = (dish[i.itemId] || 0) + i.qty;
  const topDishes = Object.entries(dish).map(([itemId, qty]) => ({ itemId, qty })).sort((a, b) => b.qty - a.qty).slice(0, 6);

  // Customer satisfaction per week (4 weeks, newest last)
  const fb = [...history.feedback.filter((f) => f.day !== todayKey), ...(state.feedback || []).map((f) => ({ ...f, day: dayKey(f.at) }))];
  const isComplaint = (f) => f.kind === 'complaint' || (f.kind === 'rating' && f.rating <= 2);
  const weeks = [3, 2, 1, 0].map((w) => {
    const from = today - (w * 7 + 6) * DAY; const to = today - w * 7 * DAY + DAY;
    const inWeek = (ms) => ms >= from && ms < to;
    const f = fb.filter((x) => inWeek(x.at));
    const pos = f.filter((x) => x.sentiment === 'positive').length;
    const neg = f.filter((x) => x.sentiment === 'negative').length;
    const orders = all.filter((o) => inWeek(dayStart(o.createdAt || today))).length;
    return { label: w === 0 ? 'this' : `-${w}`, happyPct: pos + neg ? Math.round(pos / (pos + neg) * 100) : null, complaints: f.filter(isComplaint).length, per100: orders ? Math.round(f.filter(isComplaint).length / orders * 1000) / 10 : 0, feedback: f.length };
  });
  const topics = {};
  for (const f of fb.filter((x) => x.sentiment === 'negative' && x.at >= today - 27 * DAY)) for (const t of f.topics || []) topics[t] = (topics[t] || 0) + 1;
  const complaintTopics = Object.entries(topics).map(([topic, n]) => ({ topic, n })).sort((a, b) => b.n - a.n).slice(0, 5);
  const quotes = fb.filter((f) => f.kind !== 'rating' && f.text).sort((a, b) => b.at - a.at).slice(0, 3);

  // Time saved per day (last 14 days)
  const st = new Map(history.stats.map((s) => [s.day, s]));
  if (state.stats && state.stats.day === new Date(now).toDateString()) st.set(todayKey, state.stats);
  const saved = [];
  for (let b = 13; b >= 0; b--) {
    const d = dayKey(today - b * DAY); const s = st.get(d) || { answered: 0, handsFree: 0 };
    saved.push({ day: d, minutes: Math.round((s.answered * SAVED_SECONDS.answered + s.handsFree * SAVED_SECONDS.handsFree) / 60), today: b === 0 });
  }

  return { weekday: wd, slots, perDay, topDishes, weeks, complaintTopics, quotes, saved, sample: history.sample };
}
