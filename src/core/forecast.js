// Morning forecast: how much to make today. Simple, explainable maths (no black box):
//  1. the same weekday over the last 4 weeks, recent weeks counting more (weights 4, 3, 2, 1);
//  2. adjusted by this week's trend (last 7 days vs the 7 before), capped at ±20%;
//  3. shown as a range. Fewer than 2 past same-weekdays -> "not enough history" (never a made-up number).
import { dayKey, dayStart } from './history.js';

const DAY = 24 * 3600 * 1000;
const WEIGHTS = [4, 3, 2, 1];
const BOOKED = ['awaiting', 'pending', 'confirmed', 'delivered'];
const qtyOf = (o, itemId) => o.items.filter((i) => i.itemId === itemId).reduce((s, i) => s + (i.qty || 0), 0);

export function forecast(history, todayOrders, now) {
  const past = history.filter((o) => o.status !== 'declined' && o.status !== 'cancelled');
  const today = dayStart(now);
  const wd = new Date(today).getDay();
  const byDay = new Map();
  for (const o of past) { if (!byDay.has(o.day)) byDay.set(o.day, []); byDay.get(o.day).push(o); }

  // last 4 same weekdays that had orders, newest first
  const same = [];
  for (let w = 1; w <= 8 && same.length < 4; w++) {
    const day = dayKey(today - w * 7 * DAY);
    if (byDay.has(day)) same.push({ day, orders: byDay.get(day) });
  }
  const soFar = todayOrders.filter((o) => BOOKED.includes(o.status)).reduce((s, o) => s + qtyOf(o, 'thali'), 0);
  if (same.length < 2) return { enough: false, weekday: wd, soFar };

  const weighted = (fn) => {
    const ws = WEIGHTS.slice(0, same.length);
    return same.reduce((s, d, i) => s + fn(d.orders) * ws[i], 0) / ws.reduce((a, b) => a + b, 0);
  };
  const sumDays = (from, to) => { // days back [from, to)
    let total = 0;
    for (let b = from; b < to; b++) total += (byDay.get(dayKey(today - b * DAY)) || []).reduce((s, o) => s + qtyOf(o, 'thali'), 0);
    return total;
  };
  const last7 = sumDays(1, 8);
  const prev7 = sumDays(8, 15);
  const trend = prev7 > 0 ? Math.max(-0.2, Math.min(0.2, last7 / prev7 - 1)) : 0;

  const base = weighted((os) => os.reduce((s, o) => s + qtyOf(o, 'thali'), 0));
  const mid = Math.round(base * (1 + trend));
  const spread = Math.max(2, Math.round(mid * 0.12));

  const itemIds = [...new Set(same.flatMap((d) => d.orders.flatMap((o) => o.items.map((i) => i.itemId))))];
  const perDish = itemIds.map((itemId) => ({ itemId, qty: Math.round(weighted((os) => os.reduce((s, o) => s + qtyOf(o, itemId), 0)) * (1 + trend)) }))
    .filter((d) => d.qty > 0).sort((a, b) => b.qty - a.qty);

  const slots = new Map();
  for (const d of same) for (const o of d.orders) {
    if (!o.promised) continue;
    const k = `${o.promised.hour}:${o.promised.minute || 0}`;
    slots.set(k, (slots.get(k) || 0) + qtyOf(o, 'thali'));
  }
  const [busiestKey] = [...slots.entries()].sort((a, b) => b[1] - a[1])[0] || ['13:0'];
  const [bh, bm] = busiestKey.split(':').map(Number);

  const notes = Math.round(weighted((os) => os.filter((o) => (o.notes || []).includes('bina pyaaz')).reduce((s, o) => s + qtyOf(o, 'thali'), 0)));

  return {
    enough: true, weekday: wd, low: Math.max(0, mid - spread), mid, high: mid + spread,
    trendPct: Math.round(trend * 100), sameDays: same.map((d) => ({ day: d.day, thali: d.orders.reduce((s, o) => s + qtyOf(o, 'thali'), 0) })),
    perDish, busiest: { hour: bh, minute: bm }, binaPyaaz: notes, soFar,
  };
}
