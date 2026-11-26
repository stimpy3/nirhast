// Handles customer WhatsApp messages (simulated in the demo).
// Rules decide what to do; nothing is guessed. Missing details -> ask one question.
// Questions the kitchen data can't answer -> owner queue.

import { normalize, tokens, extractNumbers, parseTime, includesAny, classifyReply } from './text.js';
import { NOTE_SYNONYMS } from './sampleData.js';

const GREETINGS = ['hi', 'hii', 'hello', 'hey', 'namaste', 'namaskar', 'helo', 'नमस्ते', 'नमस्कार', 'हाय', 'हेलो'];
const MENU_WORDS = ['menu', 'aaj kya hai', 'kya bana', 'kya banaya', 'kya milega', 'aaj kya', 'मेनू', 'आज क्या'];
const PRICE_WORDS = ['price', 'rate', 'kitne ka', 'kitne ki', 'kitna', 'kimat', 'keemat', 'daam', 'कितने का', 'कीमत', 'किती'];
const TIMING_WORDS = ['timing', 'kab tak', 'kitne baje tak', 'open', 'khula', 'kab band', 'band kab', 'time kya', 'कब तक'];
const USUAL_WORDS = ['usual', 'roz wala', 'roj wala', 'same', 'hamesha wala', 'regular', 'रोज वाला', 'नेहमीचे', 'nehmiche'];
const CHANGE_WORDS = ['kar do', 'karo', 'badal', 'badlo', 'change', 'instead', 'ki jagah', 'ke badle', 'chahiye ab', 'update', 'बदल', 'कर दो'];
const QUESTION_WORDS = ['hai kya', 'milega', 'milegi', 'hai aaj', 'kya', 'kab', 'kaise', 'kyun', 'kitna', 'kitne', 'available', 'है क्या', 'मिलेगा', 'क्या'];

export function menuText(state) {
  const items = state.menu.map((m) => `${m.name} ₹${m.price}`).join(', ');
  return `Aaj ka menu: ${items}. Order ke liye likhiye, jaise: "2 thali 1 baje".`;
}

function hoursText(state) {
  const f = ({ hour, minute }) => {
    const h12 = ((hour + 11) % 12) + 1;
    const ampm = hour < 12 ? 'subah' : 'shaam';
    return `${ampm} ${h12}${minute ? ':' + String(minute).padStart(2, '0') : ''}`;
  };
  return `Kitchen ${f(state.hours.open)} se ${f(state.hours.close)} tak khula hai.`;
}

export function findItems(state, text) {
  const n = ` ${normalize(text)} `;
  const tk = tokens(text);
  const nums = extractNumbers(text);
  const found = [];
  for (const item of state.menu) {
    // longest synonym first so "aloo gobi" wins over "aloo"
    const syns = [...item.synonyms].sort((a, b) => b.length - a.length);
    const syn = syns.find((s) => n.includes(` ${normalize(s)} `));
    if (!syn) continue;
    const firstWord = normalize(syn).split(' ')[0];
    const pos = tk.indexOf(firstWord);
    // quantity = a number in the 2 words before the item
    const near = nums.filter((x) => pos >= 0 && x.index < pos && pos - x.index <= 2);
    found.push({ itemId: item.id, qty: near.length ? near[near.length - 1].value : null, pos });
  }
  // a single number and a single item -> that number is the quantity ("thali 2 chahiye")
  if (found.length === 1 && found[0].qty === null) {
    const timeNums = new Set();
    const t = parseTime(text);
    if (t) extractNumbers(text).forEach((x) => { if (n.includes(`${x.value} baje`) || n.includes(`${x.value} bje`)) timeNums.add(x.index); });
    const rest = nums.filter((x) => !timeNums.has(x.index));
    if (rest.length === 1) found[0].qty = rest[0].value;
  }
  return found.map(({ itemId, qty }) => ({ itemId, qty }));
}

function findNotes(text) {
  return Object.entries(NOTE_SYNONYMS).filter(([, syns]) => includesAny(text, syns)).map(([k]) => k);
}

function itemsLabel(state, items) {
  return items.map((i) => `${i.qty} ${state.menu.find((m) => m.id === i.itemId)?.name.toLowerCase() || i.itemId}`).join(', ');
}

function sameItems(a, b) {
  const key = (xs) => xs.map((x) => `${x.itemId}:${x.qty}`).sort().join('|');
  return key(a) === key(b);
}

export function activeOrdersFor(state, customerId) {
  return state.orders.filter((o) => o.customerId === customerId && ['awaiting', 'pending', 'confirmed'].includes(o.status));
}

// Returns { state, effects } — never mutates the input.
export function handleCustomerMessage(prev, customerId, text, now) {
  const state = structuredClone(prev);
  const effects = [];
  const reply = (t) => effects.push({ type: 'customerReply', customerId, text: t });
  const customer = state.customers.find((c) => c.id === customerId);
  if (!customer) return { state, effects };
  state.chats[customerId] = state.chats[customerId] || [];
  state.chats[customerId].push({ from: 'customer', text, at: now });

  const draft = state.drafts[customerId] || null;
  const items = findItems(state, text);
  const time = parseTime(text);
  const notes = findNotes(text);
  const wantsUsual = includesAny(text, USUAL_WORDS);
  const looksLikeOrder = items.length > 0 || wantsUsual;

  // 1. Duplicate check waiting for an answer
  if (draft && draft.awaiting === 'duplicate') {
    const r = classifyReply(text);
    if (r.kind === 'yes') {
      delete state.drafts[customerId];
      return finish(createOrder(state, customer, draft, now));
    }
    if (r.kind === 'no') {
      delete state.drafts[customerId];
      reply('Theek hai, pehla order hi rahega.');
      return finish({ state, effects: [] });
    }
    reply('Doosra order bhi chahiye? "haan" ya "nahi" likhiye.');
    return finish({ state, effects: [] });
  }

  // 2. Orders paused near closing
  if (state.ordersPaused && looksLikeOrder) {
    reply('Maaf kijiye, aaj ke order band ho gaye. Kal zaroor order kijiye.');
    return finish({ state, effects: [] });
  }

  // 3. Change to an existing order ("3 thali kar do")
  const active = activeOrdersFor(state, customerId);
  if (active.length && includesAny(text, CHANGE_WORDS) && extractNumbers(text).length) {
    const order = active[active.length - 1];
    const newQty = items.find((i) => i.qty)?.qty ?? extractNumbers(text).slice(-1)[0].value;
    effects.push({ type: 'orderChange', orderId: order.id, newQty, newTime: time });
    reply('Badlav kitchen ko bhej diya. Confirm hote hi batayenge.');
    return finish({ state, effects: [] });
  }

  // 4. Filling in a missing detail
  if (draft && draft.awaiting) {
    const d = draft;
    if (d.awaiting === 'qty') {
      const nums = extractNumbers(text);
      if (items.length && items.every((i) => i.qty)) d.items = items;
      else if (nums.length) d.items = d.items.map((i) => ({ ...i, qty: i.qty ?? nums[0].value }));
    } else if (d.awaiting === 'time') {
      if (time) d.promised = time;
    } else if (d.awaiting === 'address') {
      if (normalize(text).length >= 6) d.address = text.trim();
    }
    if (time && !d.promised) d.promised = time;
    d.notes = [...new Set([...(d.notes || []), ...notes])];
    return finish(continueDraft(state, customer, d, now));
  }

  // 5. New order
  if (looksLikeOrder) {
    let d;
    if (wantsUsual && items.length === 0) {
      if (!customer.usual) {
        reply('Aapka pehla order hai. Kitni thali, kitne baje chahiye?');
        state.drafts[customerId] = { items: [{ itemId: 'thali', qty: null }], promised: time, address: null, notes, awaiting: 'qty' };
        return finish({ state, effects: [] });
      }
      d = { items: [{ ...customer.usual }], promised: time, address: null, notes };
    } else {
      d = { items, promised: time, address: null, notes };
    }
    return finish(continueDraft(state, customer, d, now));
  }

  // 6. Greetings, menu, price, timing — answered from owner data only
  if (includesAny(text, GREETINGS) && tokens(text).length <= 4) {
    reply(`Namaste ${customer.name} ji! ${menuText(state)}`);
    if (customer.usual) reply(`Roz wala order bhejein? ${itemsLabel(state, [customer.usual])}. "usual" likhiye.`);
    return finish({ state, effects: [] });
  }
  if (includesAny(text, MENU_WORDS) || includesAny(text, PRICE_WORDS)) {
    reply(menuText(state));
    return finish({ state, effects: [] });
  }
  if (includesAny(text, TIMING_WORDS)) {
    reply(hoursText(state));
    return finish({ state, effects: [] });
  }

  // 7. A question only the owner can answer
  if (String(text).includes('?') || includesAny(text, QUESTION_WORDS)) {
    const q = { id: `q${state.nextQuestionNo++}`, customerId, text: text.trim(), status: 'open', at: now };
    state.ownerQueue.push(q);
    reply('Aapka sawaal kitchen ko bhej diya. Jaldi jawab milega.');
    effects.push({ type: 'ownerQuestion', questionId: q.id });
    return finish({ state, effects: [] });
  }

  // 8. Unclear -> ask, never guess
  reply('Maaf kijiye, samjha nahi. Order ke liye likhiye, jaise: "2 thali 1 baje".');
  return finish({ state, effects: [] });

  function finish(res) {
    const out = res.state;
    const all = [...effects, ...res.effects];
    for (const e of all) {
      if (e.type === 'customerReply') {
        out.chats[e.customerId] = out.chats[e.customerId] || [];
        out.chats[e.customerId].push({ from: 'kitchen', text: e.text, at: now });
      }
    }
    return { state: out, effects: all };
  }
}

function continueDraft(state, customer, d, now) {
  const effects = [];
  const ask = (field, t) => {
    d.awaiting = field;
    state.drafts[customer.id] = d;
    effects.push({ type: 'customerReply', customerId: customer.id, text: t });
    return { state, effects };
  };
  const missingQty = d.items.find((i) => !i.qty);
  if (missingQty) {
    const name = state.menu.find((m) => m.id === missingQty.itemId)?.name.toLowerCase() || 'thali';
    return ask('qty', `Kitni ${name} chahiye?`);
  }
  if (!d.promised) return ask('time', 'Kitne baje chahiye?');
  if (!d.address && !customer.address) return ask('address', 'Delivery ka address bhejiye.');
  if (d.address && !customer.address) customer.address = d.address; // remember for next time

  // Duplicate: same items and time as an active order
  const dup = activeOrdersFor(state, customer.id).find((o) => sameItems(o.items, d.items) && o.promised?.label === d.promised.label);
  if (dup) {
    d.awaiting = 'duplicate';
    state.drafts[customer.id] = d;
    effects.push({ type: 'customerReply', customerId: customer.id, text: `Yeh order pehle se hai (${itemsLabel(state, d.items)}, ${d.promised.label}). Doosra order bhi chahiye? "haan" ya "nahi".` });
    return { state, effects };
  }
  delete state.drafts[customer.id];
  return createOrder(state, customer, d, now);
}

function createOrder(state, customer, d, now) {
  const order = {
    id: `o${state.nextOrderNo}`,
    no: state.nextOrderNo++,
    customerId: customer.id,
    items: d.items,
    promised: d.promised,
    address: d.address || customer.address,
    notes: d.notes || [],
    status: 'awaiting',
    createdAt: now,
    alerted: false,
  };
  state.orders.push(order);
  return {
    state,
    effects: [
      { type: 'customerReply', customerId: customer.id, text: 'Order mil gaya. Kitchen confirm karte hi batayenge.' },
      { type: 'orderReady', orderId: order.id },
    ],
  };
}

export { itemsLabel };
