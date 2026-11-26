// The kitchen voice engine. Pure functions: (state, input, now) -> { state, effects }.
// Rules decide everything (ranking, timers, retries, owner checks).
// Speech recognition only turns sound into text; this file decides what it means.

import { classifyReply, extractNumbers, includesAny, normalize, numberToHindi, parseTime, tokens } from './text.js';
import { itemsLabel } from './customerBot.js';

export const TIMING = {
  listenWindowMs: 6000, // wait up to 6 s for the cook to start replying after a question
  silenceMs: 1000, // a reply ends after 1 s of silence...
  silenceNumberMs: 2000, // ...or 2 s when a number or correction is expected
  undoWindowMs: 15000,
  snoozeMs: 5 * 60 * 1000,
  lateAlertMs: 10 * 60 * 1000,
  closingWarnMs: 30 * 60 * 1000,
  defaultQuietMin: 10,
};

const CMD = {
  stop: ['ruko', 'ruk jao', 'stop', 'bas karo', 'chup', 'रुको', 'थांबा', 'thamba'],
  undo: ['galat wapas', 'galat', 'wapas', 'undo', 'galti', 'गलत', 'वापस', 'chukla'],
  quiet: ['abhi mat bolo', 'mat bolo', 'chup raho', 'shant raho', 'baad mein bolna', 'disturb mat', 'मत बोलो', 'बोलू नका', 'bolu naka'],
  next: ['ab kya banaun', 'ab kya banau', 'kya banaun', 'kya banau', 'kya banana hai', 'next kya', 'pehle kya', 'क्या बनाऊं', 'क्या बनाऊँ', 'काय बनवू', 'kay banvu'],
  prep: ['kitne thali', 'kitni thali', 'kitne tiffin', 'kitna banana', 'prep', 'total kitna', 'कितनी थाली', 'कितने थाली', 'किती थाळी', 'kiti thali'],
  delivered: ['delivered', 'deliver ho gaya', 'deliver kiya', 'de diya', 'de aaya', 'pahuncha', 'pohocha', 'pahunch gaya', 'दे दिया', 'पहुंचा', 'पोहोचलं'],
  cancel: ['cancel', 'radd', 'रद्द', 'कैंसल'],
  refund: ['refund', 'paise wapas', 'रिफंड'],
  price: ['price badlo', 'daam badlo', 'rate badlo', 'price change', 'naya rate', 'daam', 'दाम'],
};

const OWNER_PHRASES = ['neela aasman', 'garam chai', 'meetha aam', 'laal tamatar', 'hara dhaniya', 'thanda paani'];

function customerOf(state, order) {
  return state.customers.find((c) => c.id === order.customerId);
}
function orderById(state, id) {
  return state.orders.find((o) => o.id === id);
}
function promisedMs(order, now) {
  if (!order.promised) return Infinity;
  const d = new Date(now);
  d.setHours(order.promised.hour, order.promised.minute || 0, 0, 0);
  return d.getTime();
}
function closeMs(state, now) {
  const d = new Date(now);
  d.setHours(state.hours.close.hour, state.hours.close.minute || 0, 0, 0);
  return d.getTime();
}
function mainQty(order) {
  return order.items.reduce((s, i) => s + (i.qty || 0), 0);
}

function ctx(prev, now) {
  const state = structuredClone(prev);
  const effects = [];
  const api = {
    state,
    effects,
    say(text, opts = {}) { effects.push({ type: 'say', text, kind: opts.kind || 'info', orderId: opts.orderId }); },
    listen(expect = 'yesno') { effects.push({ type: 'listen', expect }); },
    reply(customerId, text) {
      effects.push({ type: 'customerReply', customerId, text });
      state.chats[customerId] = state.chats[customerId] || [];
      state.chats[customerId].push({ from: 'kitchen', text, at: now });
    },
    log(action) { state.log.unshift({ at: now, action, speaker: state.speakingAs }); state.log = state.log.slice(0, 200); },
    done() { return { state, effects }; },
  };
  return api;
}

// ---------- prompts ----------
function confirmPrompt(state, order) {
  const c = customerOf(state, order);
  return `${c.name} ji, ${itemsLabel(state, order.items)}, ${order.promised.label}. Haan?`;
}

function askDialog(k, dialog, line, expect) {
  k.state.dialog = { ...dialog, prompt: line, attempts: dialog.attempts || 0, repeated: false };
  k.say(line, { kind: 'question', orderId: dialog.orderId });
  k.listen(expect);
}

function startConfirm(k, order) {
  askDialog(k, { kind: 'confirm', orderId: order.id, stage: 'confirm' }, confirmPrompt(k.state, order), 'number');
}

// Pick the next thing to ask about, only when nothing else is open and quiet mode is off.
function startNext(k, now) {
  const s = k.state;
  if (s.dialog || s.quietUntil) return;
  const awaiting = s.orders
    .filter((o) => o.status === 'awaiting' && !(s.snoozed[o.id] && s.snoozed[o.id] > now))
    .sort((a, b) => a.createdAt - b.createdAt);
  if (awaiting.length) { startConfirm(k, awaiting[0]); return; }
  const q = s.ownerQueue.find((x) => x.status === 'open');
  if (q) {
    const c = s.customers.find((x) => x.id === q.customerId);
    askDialog(k, { kind: 'ownerQ', questionId: q.id, stage: 'answer' }, `${c.name} ji pooch rahe hain: ${q.text.replace(/\?+$/, '')}?`, 'free');
  }
}

// ---------- ladder ----------
function unclear(k, now) {
  const d = k.state.dialog;
  d.attempts += 1;
  if (d.attempts === 1) { k.say('Phir boliye.', { kind: 'question', orderId: d.orderId }); k.listen(d.kind === 'confirm' ? 'number' : 'yesno'); return; }
  if (d.attempts === 2) { k.say('Haan ya nahi boliye.', { kind: 'question', orderId: d.orderId }); k.listen('yesno'); return; }
  // 3rd time: stop asking, leave it on screen with buttons
  if (d.kind === 'confirm') {
    const o = orderById(k.state, d.orderId);
    if (o) o.status = 'pending';
    k.say('Button se bataiye.', { kind: 'info', orderId: d.orderId });
  } else {
    k.say('Baad mein poochungi.');
  }
  k.state.dialog = null;
  k.log(`Unclear 3 times; left on screen${d.orderId ? ` (${d.orderId})` : ''}`);
  startNext(k, now);
}

// ---------- order actions ----------
function confirmOrder(k, order, now) {
  order.status = 'confirmed';
  order.confirmedAt = now;
  // Save first; only then tell the customer.
  k.reply(order.customerId, `Order confirmed: ${itemsLabel(k.state, order.items)}, ${order.promised.label} tak. Dhanyavaad!`);
  k.state.lastAction = { kind: 'confirm', orderId: order.id, at: now };
  k.say('Saved.', { kind: 'saved', orderId: order.id });
  k.log(`Confirmed ${order.id} (${customerOf(k.state, order).name})`);
}

function declineOrder(k, order, now) {
  order.status = 'declined';
  k.reply(order.customerId, 'Maaf kijiye, aaj yeh order nahi le paayenge.');
  k.state.lastAction = { kind: 'decline', orderId: order.id, at: now };
  k.say('Theek hai, mana kar diya.', { kind: 'saved', orderId: order.id });
  k.log(`Declined ${order.id}`);
}

function isBigOrder(state, order) {
  const c = customerOf(state, order);
  if (!c?.usual) return false;
  return mainQty(order) > 3 * c.usual.qty;
}

// ---------- public API ----------
export function onOrderReady(prev, orderId, now) {
  const k = ctx(prev, now);
  k.log(`New order ${orderId}`);
  startNext(k, now);
  return k.done();
}

export function onOwnerQuestion(prev, questionId, now) {
  const k = ctx(prev, now);
  k.log(`Owner question ${questionId}`);
  startNext(k, now);
  return k.done();
}

export function onOrderChange(prev, orderId, newQty, newTime, now) {
  const k = ctx(prev, now);
  const o = orderById(k.state, orderId);
  if (!o) return k.done();
  if (newQty) o.items = [{ ...o.items[0], qty: newQty }, ...o.items.slice(1)];
  if (newTime) o.promised = newTime;
  o.status = 'awaiting';
  o.changed = true;
  k.log(`Change requested for ${orderId}`);
  startNext(k, now);
  return k.done();
}

export function onButton(prev, orderId, answer, now) {
  const k = ctx(prev, now);
  const o = orderById(k.state, orderId);
  if (!o || !['awaiting', 'pending'].includes(o.status)) return k.done();
  if (k.state.dialog?.orderId === orderId) k.state.dialog = null;
  if (answer === 'yes') confirmOrder(k, o, now); else declineOrder(k, o, now);
  startNext(k, now);
  return k.done();
}

// Nothing was heard in the listening window.
export function onNoReply(prev, now) {
  const k = ctx(prev, now);
  const d = k.state.dialog;
  if (!d) return k.done();
  if (!d.repeated) {
    d.repeated = true;
    k.say(d.prompt, { kind: 'question', orderId: d.orderId });
    k.listen(d.kind === 'confirm' ? 'number' : 'yesno');
    return k.done();
  }
  unclear(k, now);
  return k.done();
}

export function setSpeakingAs(prev, who) {
  return { ...prev, speakingAs: who };
}

export function onHeard(prev, rawText, now) {
  const k = ctx(prev, now);
  const s = k.state;
  const text = String(rawText || '').trim();
  s.lastHeard = { text, at: now };
  if (!text) return k.done();
  const d = s.dialog;

  // Owner phrase check has priority over everything else
  if (d?.kind === 'phrase') {
    if (normalize(text).includes(normalize(d.phrase))) {
      s.dialog = null;
      doOwnerAction(k, d.action, now);
    } else {
      s.dialog = null;
      k.say('Phrase match nahi hua. Kuch nahi badla.');
      k.log(`Owner check failed for ${d.action.kind}`);
    }
    startNext(k, now);
    return k.done();
  }

  // ---- commands that work at any time ----
  if (includesAny(text, CMD.stop) && tokens(text).length <= 3) {
    k.effects.push({ type: 'stopSpeaking' });
    k.log('Stopped speaking (ruko)');
    return k.done();
  }
  if (includesAny(text, CMD.undo) && !classifyReplyIsPlainNo(text)) {
    undo(k, now);
    return k.done();
  }
  if (includesAny(text, CMD.quiet)) {
    if (d?.kind === 'confirm' || d?.kind === 'ownerQ') s.dialog = null; // will be asked again after quiet
    askDialog(k, { kind: 'quiet' }, `${TIMING.defaultQuietMin} minute?`, 'number');
    return k.done();
  }
  if (includesAny(text, CMD.next)) {
    sayNextDish(k, now);
    return k.done();
  }
  if (includesAny(text, CMD.prep)) {
    sayPrep(k);
    return k.done();
  }
  if (includesAny(text, CMD.delivered)) {
    markDelivered(k, text, now);
    return k.done();
  }
  const ownerKind = includesAny(text, CMD.cancel) ? 'cancel' : includesAny(text, CMD.refund) ? 'refund' : (includesAny(text, CMD.price) && extractNumbers(text).length ? 'price' : null);
  if (ownerKind) {
    requestOwnerAction(k, ownerKind, text, now);
    return k.done();
  }
  if (!d && isMenuCommand(text)) {
    const m = parseMenuCommand(s, text);
    askDialog(k, { kind: 'menu', menu: m }, `${m.dishes.join(', ')}, thali ${m.price}. Sahi?`, 'yesno');
    return k.done();
  }

  // ---- answers to the open question ----
  if (!d) {
    // No open question and no command: probably background talk. Show it, do nothing.
    k.effects.push({ type: 'ignored', text });
    return k.done();
  }

  if (d.kind === 'ownerQ' && d.stage === 'answer') {
    d.answer = text;
    d.stage = 'send';
    askDialog(k, d, `Bhej doon: "${text}"?`, 'yesno');
    return k.done();
  }

  const r = classifyReply(text);

  if (d.kind === 'confirm') {
    const o = orderById(s, d.orderId);
    if (!o) { s.dialog = null; startNext(k, now); return k.done(); }
    if (r.kind === 'yes') {
      if (d.stage === 'confirm' && isBigOrder(s, o)) {
        askDialog(k, { ...d, stage: 'sanity', attempts: 0 }, `${mainQty(o)} thali? Sach mein?`, 'yesno');
        return k.done();
      }
      s.dialog = null;
      confirmOrder(k, o, now);
    } else if (r.kind === 'no') {
      s.dialog = null;
      declineOrder(k, o, now);
    } else if (r.kind === 'later') {
      s.dialog = null;
      s.snoozed[o.id] = now + TIMING.snoozeMs;
      k.say('Theek hai, 5 minute baad.');
      k.log(`Snoozed ${o.id} for 5 min`);
    } else if (r.kind === 'correction' && d.stage === 'confirm') {
      o.items = [{ ...o.items[0], qty: r.value }, ...o.items.slice(1)];
      k.log(`Corrected ${o.id} qty to ${r.value}`);
      askDialog(k, { ...d, attempts: 0 }, confirmPrompt(s, o), 'number');
      return k.done();
    } else {
      unclear(k, now);
      return k.done();
    }
    startNext(k, now);
    return k.done();
  }

  if (d.kind === 'quiet') {
    let minutes = null;
    if (r.kind === 'yes') minutes = TIMING.defaultQuietMin;
    else if (r.kind === 'correction') minutes = r.value;
    else if (r.kind === 'no') { s.dialog = null; k.say('Theek hai.'); startNext(k, now); return k.done(); }
    if (!minutes) { unclear(k, now); return k.done(); }
    s.dialog = null;
    s.quietUntil = now + minutes * 60 * 1000;
    k.say(`Theek hai, ${minutes} minute.`, { kind: 'saved' });
    k.log(`Quiet mode ${minutes} min`);
    return k.done();
  }

  if (d.kind === 'ownerQ' && d.stage === 'send') {
    const q = s.ownerQueue.find((x) => x.id === d.questionId);
    if (r.kind === 'yes') {
      s.dialog = null;
      q.status = 'answered';
      q.answer = d.answer;
      k.reply(q.customerId, d.answer);
      k.say('Bhej diya.', { kind: 'saved' });
      k.log(`Answered ${q.id}`);
    } else if (r.kind === 'no') {
      s.dialog = null;
      askDialog(k, { kind: 'ownerQ', questionId: q.id, stage: 'answer' }, 'Toh kya bolun?', 'free');
      return k.done();
    } else { unclear(k, now); return k.done(); }
    startNext(k, now);
    return k.done();
  }

  if (d.kind === 'closing') {
    s.dialog = null;
    if (r.kind === 'yes') { s.ordersPaused = true; k.say('Naye order band.', { kind: 'saved' }); k.log('Orders paused for the day'); }
    else if (r.kind === 'no') { k.say('Theek hai, chalu rakhti hoon.'); }
    else { s.dialog = d; unclear(k, now); return k.done(); }
    startNext(k, now);
    return k.done();
  }

  if (d.kind === 'menu') {
    s.dialog = null;
    if (r.kind === 'yes') {
      s.todayDishes = d.menu.dishes;
      const thali = s.menu.find((m) => m.id === 'thali');
      if (thali && d.menu.price) thali.price = d.menu.price;
      k.say('Menu saved.', { kind: 'saved' });
      k.log(`Menu set: ${d.menu.dishes.join(', ')}, thali ${d.menu.price}`);
    } else if (r.kind === 'no') { k.say('Theek hai, phir se boliye.'); }
    else { s.dialog = d; unclear(k, now); return k.done(); }
    startNext(k, now);
    return k.done();
  }

  return k.done();
}

function classifyReplyIsPlainNo(text) {
  // "galat" alone is undo; but "nahi" is an answer, not undo
  return tokens(text).every((w) => ['nahi', 'na', 'no', 'nako', 'नहीं', 'ना'].includes(w));
}

function capital(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function undo(k, now) {
  const s = k.state;
  const a = s.lastAction;
  if (!a || now - a.at > TIMING.undoWindowMs) {
    k.say('Wapas karne ki der ho gayi.');
    return;
  }
  const o = orderById(s, a.orderId);
  if (a.kind === 'confirm' && o) {
    o.status = 'awaiting';
    k.reply(o.customerId, 'Maaf kijiye, pichla confirmation galti se gaya. Hum dobara confirm karke batayenge.');
  } else if (a.kind === 'decline' && o) {
    o.status = 'awaiting';
    k.reply(o.customerId, 'Maaf kijiye, galti hui. Aapka order dobara dekh rahe hain.');
  } else if (a.kind === 'delivered' && o) {
    o.status = 'confirmed';
  }
  s.lastAction = null;
  s.dialog = null;
  k.say('Wapas kiya.', { kind: 'saved' });
  k.log(`Undid ${a.kind} ${a.orderId}`);
  startNext(k, now);
}

function sayNextDish(k, now) {
  const s = k.state;
  const open = s.orders.filter((o) => o.status === 'confirmed')
    .sort((a, b) => promisedMs(a, now) - promisedMs(b, now) || mainQty(a) - mainQty(b));
  if (!open.length) { k.say('Abhi koi confirmed order nahi.'); return; }
  const first = open[0];
  const c = customerOf(s, first);
  const itemId = first.items[0].itemId;
  const total = open.reduce((sum, o) => sum + o.items.filter((i) => i.itemId === itemId).reduce((x, i) => x + i.qty, 0), 0);
  const name = s.menu.find((m) => m.id === itemId)?.name.toLowerCase() || itemId;
  const line = total > first.items[0].qty
    ? `Pehle ${c.name} ji, ${first.promised.label}. ${total} ${name} ek saath.`
    : `Pehle ${c.name} ji, ${first.promised.label}. ${first.items[0].qty} ${name}.`;
  k.say(line, { kind: 'info', orderId: first.id });
  k.effects.push({ type: 'ranked', orderIds: open.map((o) => o.id) });
}

function sayPrep(k) {
  const s = k.state;
  const todays = s.orders.filter((o) => ['confirmed', 'delivered'].includes(o.status));
  if (!todays.length) { k.say('Abhi koi confirmed order nahi.'); return; }
  const byItem = {};
  todays.forEach((o) => o.items.forEach((i) => { byItem[i.itemId] = (byItem[i.itemId] || 0) + i.qty; }));
  const parts = Object.entries(byItem).sort((a, b) => b[1] - a[1]).slice(0, 2)
    .map(([id, q]) => `${q} ${s.menu.find((m) => m.id === id)?.name.toLowerCase() || id}`);
  const noteCounts = {};
  todays.forEach((o) => (o.notes || []).forEach((n) => { noteCounts[n] = (noteCounts[n] || 0) + mainQty(o); }));
  const notes = Object.entries(noteCounts).slice(0, 1).map(([n, q]) => `${q} ${n}`);
  k.say(`${[...parts, ...notes].join(', ')}.`, { kind: 'info' });
}

function markDelivered(k, text, now) {
  const s = k.state;
  const n = normalize(text);
  const candidates = s.orders.filter((o) => o.status === 'confirmed');
  const match = candidates.find((o) => n.includes(normalize(customerOf(s, o).name)));
  if (!match) { k.say('Kiska order? Naam boliye.'); return; }
  match.status = 'delivered';
  match.deliveredAt = now;
  s.lastAction = { kind: 'delivered', orderId: match.id, at: now };
  k.say('Noted.', { kind: 'saved', orderId: match.id });
  k.log(`Delivered ${match.id} (${customerOf(s, match).name})`);
}

function requestOwnerAction(k, kind, text, now) {
  const s = k.state;
  if (s.speakingAs !== 'owner') {
    k.say('Yeh sirf owner kar sakti hain.');
    k.log(`Blocked ${kind}: not owner`);
    return;
  }
  const n = normalize(text);
  let action = { kind };
  if (kind === 'cancel' || kind === 'refund') {
    const o = s.orders.find((x) => ['awaiting', 'pending', 'confirmed'].includes(x.status) && n.includes(normalize(customerOf(s, x).name)));
    if (!o) { k.say('Kiska order? Naam boliye.'); return; }
    action.orderId = o.id;
  } else if (kind === 'price') {
    const item = s.menu.find((m) => m.synonyms.some((syn) => n.includes(normalize(syn))));
    const nums = extractNumbers(text);
    if (!item || !nums.length) { k.say('Kis cheez ka daam? Phir boliye.'); return; }
    action = { kind, itemId: item.id, price: nums[nums.length - 1].value };
  }
  const phrase = OWNER_PHRASES[Math.floor(Math.random() * OWNER_PHRASES.length)];
  s.dialog = { kind: 'phrase', phrase, action, prompt: 'Screen par likha phrase boliye.', attempts: 0, repeated: false };
  k.say('Screen par likha phrase boliye.', { kind: 'question' });
  k.effects.push({ type: 'showPhrase', phrase });
  k.listen('free');
}

function doOwnerAction(k, action, now) {
  const s = k.state;
  if (action.kind === 'cancel') {
    const o = orderById(s, action.orderId);
    o.status = 'cancelled';
    k.reply(o.customerId, 'Aapka order cancel ho gaya.');
    k.say('Cancel ho gaya.', { kind: 'saved', orderId: o.id });
    k.log(`Cancelled ${o.id}`);
  } else if (action.kind === 'refund') {
    const o = orderById(s, action.orderId);
    o.refundNoted = true;
    k.say('Refund note kiya.', { kind: 'saved', orderId: o.id });
    k.log(`Refund noted for ${o.id} (payments are out of scope)`);
  } else if (action.kind === 'price') {
    const item = s.menu.find((m) => m.id === action.itemId);
    item.price = action.price;
    k.say(`${item.name} ab ${action.price}.`, { kind: 'saved' });
    k.log(`Price of ${item.name} set to ${action.price}`);
  }
}

function isMenuCommand(text) {
  const n = normalize(text);
  return /^(aaj|आज)\b/.test(n) && /(thali|थाली)/.test(n) && extractNumbers(text).length > 0;
}

function parseMenuCommand(state, text) {
  const n = normalize(text).replace(/^(aaj|आज)\s+/, '');
  const nums = extractNumbers(text);
  const price = nums.length ? nums[nums.length - 1].value : null;
  const before = n.split(/thali|थाली/)[0];
  const dishes = before.split(/\s+(?:aur|and|और)\s+|\s*,\s*|\s+/).filter((w) => w && !/^\d+$/.test(w)).slice(0, 5);
  return { dishes: dishes.map((w) => w.charAt(0).toUpperCase() + w.slice(1)), price };
}

// Timers: quiet mode ending, snoozes, late alerts, closing warning.
export function tick(prev, now) {
  const k = ctx(prev, now);
  const s = k.state;

  // Late alerts break through quiet mode
  for (const o of s.orders) {
    if (o.status !== 'confirmed' || o.alerted) continue;
    const left = promisedMs(o, now) - now;
    if (left > 0 && left <= TIMING.lateAlertMs) {
      o.alerted = true;
      const mins = Math.max(1, Math.round(left / 60000));
      k.say(`${customerOf(s, o).name} ji ka order ${mins} minute mein due.`, { kind: 'alert', orderId: o.id });
      k.log(`Late alert ${o.id}`);
    }
  }

  if (s.quietUntil && now >= s.quietUntil) {
    s.quietUntil = null;
    const waiting = s.orders.filter((o) => o.status === 'awaiting').length + s.ownerQueue.filter((q) => q.status === 'open').length;
    k.log('Quiet mode ended');
    if (waiting) k.say(`${waiting} naye kaam.`, { kind: 'info' });
  }

  if (!s.closingWarned && !s.ordersPaused && closeMs(s, now) - now <= TIMING.closingWarnMs && closeMs(s, now) > now && !s.dialog && !s.quietUntil) {
    s.closingWarned = true;
    const left = s.orders.filter((o) => ['awaiting', 'pending', 'confirmed'].includes(o.status)).length;
    askDialog(k, { kind: 'closing' }, `${left} order baaki. Naye order band karoon?`, 'yesno');
    return k.done();
  }

  startNext(k, now);
  return k.done();
}
