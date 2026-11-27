// The kitchen's database: one SQLite file on the server (built into Node, no extra install).
// Keeps orders, customer feedback and daily "saved" counts across days, for the forecast and Analytics.
// Rows are stored as JSON next to a few columns used for lookups. If SQLite is not available, a JSON file is used.
import fs from 'node:fs';
import path from 'node:path';
import { sampleHistory } from '../src/core/history.js';
import { SAMPLE_CUSTOMERS } from '../src/core/sampleData.js';

export async function openDb(dir) {
  fs.mkdirSync(dir, { recursive: true });
  let sqlite = null;
  try { sqlite = await import('node:sqlite'); } catch { /* older Node: JSON file below */ }
  return sqlite ? sqliteStore(sqlite, path.join(dir, 'nirhast.db')) : jsonStore(path.join(dir, 'nirhast.json'));
}

function sqliteStore({ DatabaseSync }, file) {
  const db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders   (key TEXT PRIMARY KEY, day TEXT NOT NULL, sample INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS feedback (key TEXT PRIMARY KEY, day TEXT NOT NULL, sample INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS stats    (day TEXT PRIMARY KEY, sample INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS orders_day ON orders(day);
    CREATE INDEX IF NOT EXISTS feedback_day ON feedback(day);
  `);
  const ins = {
    orders: db.prepare('INSERT OR REPLACE INTO orders (key, day, sample, data) VALUES (?, ?, ?, ?)'),
    feedback: db.prepare('INSERT OR REPLACE INTO feedback (key, day, sample, data) VALUES (?, ?, ?, ?)'),
    stats: db.prepare('INSERT OR REPLACE INTO stats (day, sample, data) VALUES (?, ?, ?)'),
  };
  const rows = (table, since) => db.prepare(`SELECT data FROM ${table} WHERE day >= ? ORDER BY day`).all(since).map((r) => JSON.parse(r.data));
  return {
    kind: 'sqlite',
    count: () => db.prepare('SELECT COUNT(*) AS n FROM orders').get().n,
    hasSample: () => db.prepare('SELECT COUNT(*) AS n FROM orders WHERE sample = 1').get().n > 0,
    insertMany(data) {
      db.exec('BEGIN');
      try {
        for (const o of data.orders || []) ins.orders.run(`${o.day}:${o.id}`, o.day, o.sample ? 1 : 0, JSON.stringify(o));
        for (const f of data.feedback || []) ins.feedback.run(`${f.day}:${f.id}`, f.day, f.sample ? 1 : 0, JSON.stringify(f));
        for (const s of data.stats || []) ins.stats.run(s.day, s.sample ? 1 : 0, JSON.stringify(s));
        db.exec('COMMIT');
      } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    // Today's live rows from the kitchen screen replace what was stored for today.
    replaceDay(day, data) {
      db.prepare('DELETE FROM orders WHERE day = ? AND sample = 0').run(day);
      db.prepare('DELETE FROM feedback WHERE day = ? AND sample = 0').run(day);
      this.insertMany({ orders: (data.orders || []).map((o) => ({ ...o, day, sample: false })), feedback: (data.feedback || []).map((f) => ({ ...f, day, sample: false })), stats: data.stats ? [{ ...data.stats, day, sample: false }] : [] });
    },
    history: (since) => ({ orders: rows('orders', since), feedback: rows('feedback', since), stats: rows('stats', since) }),
    removeSample() { db.exec('DELETE FROM orders WHERE sample = 1; DELETE FROM feedback WHERE sample = 1; DELETE FROM stats WHERE sample = 1;'); },
  };
}

function jsonStore(file) {
  let data = { orders: {}, feedback: {}, stats: {} };
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* new file */ }
  const save = () => fs.writeFileSync(file, JSON.stringify(data));
  const since = (obj, d) => Object.values(obj).filter((x) => x.day >= d).sort((a, b) => (a.day < b.day ? -1 : 1));
  return {
    kind: 'json',
    count: () => Object.keys(data.orders).length,
    hasSample: () => Object.values(data.orders).some((o) => o.sample),
    insertMany(d) {
      for (const o of d.orders || []) data.orders[`${o.day}:${o.id}`] = o;
      for (const f of d.feedback || []) data.feedback[`${f.day}:${f.id}`] = f;
      for (const s of d.stats || []) data.stats[s.day] = s;
      save();
    },
    replaceDay(day, d) {
      for (const k of Object.keys(data.orders)) if (data.orders[k].day === day && !data.orders[k].sample) delete data.orders[k];
      for (const k of Object.keys(data.feedback)) if (data.feedback[k].day === day && !data.feedback[k].sample) delete data.feedback[k];
      this.insertMany({ orders: (d.orders || []).map((o) => ({ ...o, day })), feedback: (d.feedback || []).map((f) => ({ ...f, day })), stats: d.stats ? [{ ...d.stats, day }] : [] });
    },
    history: (d) => ({ orders: since(data.orders, d), feedback: since(data.feedback, d), stats: since(data.stats, d) }),
    removeSample() {
      for (const t of ['orders', 'feedback', 'stats']) for (const k of Object.keys(data[t])) if (data[t][k].sample) delete data[t][k];
      save();
    },
  };
}

// First start: fill 5 weeks of sample history (marked sample) so the forecast and graphs have data.
export function seedSample(store, now) {
  if (store.count() > 0) return false;
  store.insertMany(sampleHistory(SAMPLE_CUSTOMERS, now));
  return true;
}
