// Sample order history so the forecast and the Analytics graphs have data in the demo.
// Same input -> same output (seeded), so tests and the demo are stable. Every row is marked `sample: true`.
// The server stores it once in its database; without a server (static live link) the browser makes it itself.

const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const dayStart = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const DAY = 24 * 3600 * 1000;

function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// How busy each weekday is (Sun..Sat): Sunday quiet, Friday busiest.
const WEEKDAY_FACTOR = [0.45, 1, 1.05, 1, 1.1, 1.2, 0.8];
const LUNCH = [[12, 30], [13, 0], [13, 0], [13, 30], [13, 30], [14, 0]];
const DINNER = [[19, 30], [20, 0], [20, 0], [20, 30], [21, 0]];

const COMPLAINTS = [
  ['Aaj khana thanda tha', ['temperature']],
  ['Delivery 40 minute late thi', ['delay', 'delivery']],
  ['Roti kam thi, 4 boli thi', ['quantity', 'wrong_item']],
  ['Dal mein namak zyada tha', ['taste']],
];
const PRAISE = [
  ['Dal bahut tasty thi, thank you!', ['taste']],
  ['Ekdum ghar jaisa khana, maza aa gaya', ['taste']],
  ['Time pe aaya, thanks', ['delivery']],
  ['Aloo gobi mast hoti', ['taste']],
];
const SUGGESTIONS = [
  ['Sunday ko bhi dinner shuru kijiye', ['menu_variety']],
  ['Kabhi kabhi rajma bhi banaiye', ['menu_variety']],
];

// customers: ids and usual orders (from sampleData).
export function sampleHistory(customers, now, days = 35) {
  const r = rng(20261127);
  const today = dayStart(now);
  const orders = [];
  const feedback = [];
  const stats = [];
  let n = 1;
  for (let back = days; back >= 1; back--) {
    const start = today - back * DAY;
    const wd = new Date(start).getDay();
    const f = WEEKDAY_FACTOR[wd];
    const day = dayKey(start);
    let dayOrders = 0;
    for (const c of customers) {
      const regular = Boolean(c.usual);
      const pLunch = Math.min(1, (regular ? 0.95 : 0.6) * f);
      const pDinner = Math.min(1, (regular ? 0.5 : 0.35) * f);
      for (const [p, slots] of [[pLunch, LUNCH], [pDinner, DINNER]]) {
        if (r() > p) continue;
        const [hour, minute] = slots[Math.floor(r() * slots.length)];
        const qty = regular ? Math.max(1, c.usual.qty + (r() < 0.3 ? 1 : 0)) : 1 + Math.floor(r() * 4);
        const items = [{ itemId: 'thali', qty }];
        if (r() < 0.25) items.push({ itemId: r() < 0.5 ? 'roti' : 'dal', qty: 1 + Math.floor(r() * 3) });
        const created = start + (hour - 2) * 3600 * 1000 + Math.floor(r() * 60) * 60000;
        orders.push({
          id: `s${n++}`, day, customerId: c.id, items, promised: { hour, minute },
          notes: r() < 0.2 ? ['bina pyaaz'] : [], status: r() < 0.04 ? 'declined' : 'delivered',
          createdAt: created, confirmedAt: created + (1 + Math.floor(r() * 4)) * 60000, sample: true,
        });
        dayOrders++;
      }
    }
    // About one feedback message a day: mostly ratings, some praise, a few complaints and suggestions.
    const fbCount = 1 + (r() < 0.5 ? 1 : 0);
    for (let i = 0; i < fbCount; i++) {
      const c = customers[Math.floor(r() * customers.length)];
      const at = start + (15 + Math.floor(r() * 6)) * 3600 * 1000;
      const x = r();
      if (x < 0.6) {
        const rating = r() < 0.7 ? (r() < 0.6 ? 5 : 4) : r() < 0.6 ? 3 : 1 + Math.floor(r() * 2);
        feedback.push({ id: `sf${n++}`, day, customerId: c.id, at, kind: 'rating', rating, sentiment: rating >= 4 ? 'positive' : rating === 3 ? 'neutral' : 'negative', topics: [], text: String(rating), sample: true });
      } else {
        const [list, kind, sentiment] = x < 0.8 ? [PRAISE, 'praise', 'positive'] : x < 0.93 ? [COMPLAINTS, 'complaint', 'negative'] : [SUGGESTIONS, 'suggestion', 'neutral'];
        const [text, topics] = list[Math.floor(r() * list.length)];
        feedback.push({ id: `sf${n++}`, day, customerId: c.id, at, kind, rating: null, sentiment, topics, text, sample: true });
      }
    }
    stats.push({ day, answered: Math.round(dayOrders * (1.4 + r())), handsFree: Math.round(dayOrders * (0.7 + r() * 0.3)), buttons: Math.round(r() * 3), sample: true });
  }
  return { orders, feedback, stats };
}
