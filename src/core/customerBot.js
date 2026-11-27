// Handles customer WhatsApp messages (simulated in the demo).
// Rules decide what to do; nothing is guessed. Missing details -> ask one question.
// Questions the kitchen data can't answer -> owner queue.

import { normalize, tokens, extractNumbers, parseTime, includesAny, classifyReply } from './text.js';
import { NOTE_SYNONYMS } from './sampleData.js';
import { line, itemsText, itemName, clockLabel, timeLabel, LANG_IDS } from './i18n.js';
import { customerRuleText } from './intents.js';
import { allNames, available, leftOf, unknownDish } from './menu.js';
import { bump } from './metrics.js';

const GREETINGS = ['hi', 'hii', 'hello', 'hey', 'namaste', 'namaskar', 'helo', 'नमस्ते', 'नमस्कार', 'हाय', 'हेलो'];
const MENU_WORDS = ['menu', 'aaj kya hai', 'kya bana', 'kya banaya', 'kya milega', 'aaj kya', 'मेनू', 'आज क्या'];
const PRICE_WORDS = ['price', 'rate', 'kitne ka', 'kitne ki', 'kitna', 'kimat', 'keemat', 'daam', 'कितने का', 'कीमत', 'किती'];
const TIMING_WORDS = ['timing', 'kab tak', 'kitne baje tak', 'open', 'khula', 'kab band', 'band kab', 'time kya', 'कब तक'];
const USUAL_WORDS = ['usual', 'roz wala', 'roj wala', 'same', 'hamesha wala', 'regular', 'रोज वाला', 'नेहमीचे', 'nehmiche'];
const CHANGE_WORDS = ['kar do', 'karo', 'badal', 'badlo', 'change', 'instead', 'ki jagah', 'ke badle', 'chahiye ab', 'update', 'बदल', 'कर दो'];
const QUESTION_WORDS = ['hai kya', 'milega', 'milegi', 'hai aaj', 'kya', 'kab', 'kaise', 'kyun', 'kitna', 'kitne', 'available', 'है क्या', 'मिलेगा', 'क्या'];

export const onToday = (m) => m.today !== false;

const dishName = (state, m, lang) => (lang === 'en' || !m.names ? m.name : itemName(state, m.id, lang));

// The full menu as sent on WhatsApp: one line per dish that is available, with price and how many are left.
export function menuText(state, lang = state.lang) {
  const items = state.menu.filter((m) => m.name && available(state, m)).map((m) => {
    const left = leftOf(state, m);
    return `• ${dishName(state, m, lang)} ₹${m.price}${left !== null ? ` (${line(lang, 'cLeft', { n: left })})` : ''}`;
  }).join('\n');
  return line(lang, 'cMenu', { items });
}

// "Yes, dal is available (₹60, 5 left)." / "Sorry, no paneer today."
function availabilityLine(state, lang, item) {
  if (typeof item === 'string') return line(lang, 'cNoItem', { item });
  const m = state.menu.find((x) => x.id === item.itemId);
  if (!available(state, m)) return line(lang, 'cNoItem', { item: dishName(state, m, lang) });
  const left = leftOf(state, m);
  return line(lang, 'cYesItem', { item: dishName(state, m, lang), price: m.price, left: left !== null ? line(lang, 'cLeft', { n: left }) : '' });
}

function hoursText(state, lang) {
  return line(lang, 'cHours', { open: clockLabel(lang, state.hours.open), close: clockLabel(lang, state.hours.close) });
}

export function findItems(state, text) {
  const n = ` ${normalize(text)} `;
  const tk = tokens(text);
  const nums = extractNumbers(text);
  const found = [];
  for (const item of state.menu) {
    // longest synonym first so "aloo gobi" wins over "aloo"
    const syns = allNames(item).sort((a, b) => b.length - a.length);
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

function itemsLabel(state, items, lang = state.lang) {
  return itemsText(state, items, lang);
}

function sameItems(a, b) {
  const key = (xs) => xs.map((x) => `${x.itemId}:${x.qty}`).sort().join('|');
  return key(a) === key(b);
}

export function activeOrdersFor(state, customerId) {
  return state.orders.filter((o) => o.customerId === customerId && ['awaiting', 'pending', 'confirmed'].includes(o.status));
}

// Returns { state, effects } — never mutates the input.
// `sorted` (optional): the AI label for this message. It only changes which words the rules read,
// or sends the message to the owner. The rules below still make every decision.
export function handleCustomerMessage(prev, customerId, rawText, now, sorted = null, extra = {}) {
  const state = structuredClone(prev);
  const effects = [];
  const reply = (t) => effects.push({ type: 'customerReply', customerId, text: t });
  const customer = state.customers.find((c) => c.id === customerId);
  if (!customer) return { state, effects };
  state.chats[customerId] = state.chats[customerId] || [];
  state.chats[customerId].push({ from: 'customer', text: rawText, at: now });
  if (sorted && LANG_IDS.includes(sorted.lang) && (sorted.confidence ?? 1) >= 0.6) customer.lang = sorted.lang;
  const lang = customer.lang || state.lang;
  const say = (key, p) => line(lang, key, p);

  const draft = state.drafts[customerId] || null;
  // While waiting for an address, take the customer's own words as they are.
  const ai = draft?.awaiting === 'address' ? null : customerRuleText(sorted, state);

  // "Is X there today?" — answered from the owner's menu rows, without the cook:
  // a yes or no for each dish asked about (on the menu or not), then the full menu.
  if (!draft) {
    let asked = findItems(state, rawText);
    let unknown = [];
    if (ai?.itemQuestion) {
      asked = ai.itemQuestion.items.map((itemId) => ({ itemId, qty: null }));
      unknown = ai.itemQuestion.other;
    } else if (!asked.length) {
      const u = unknownDish(state, rawText);
      if (u) unknown = [u];
    }
    const looksAsked = Boolean(ai?.itemQuestion) || String(rawText).includes('?') || includesAny(rawText, QUESTION_WORDS);
    const aiAllows = !sorted || ai?.itemQuestion || ai?.escalate === 'question' || ai?.ruleText === 'menu' || sorted.type === 'unclear';
    if ((asked.length || unknown.length) && looksAsked && aiAllows && !asked.some((i) => i.qty) && !parseTime(rawText)) {
      const answers = [...asked, ...unknown].map((x) => availabilityLine(state, lang, x));
      reply(`${answers.join('\n')}\n\n${menuText(state, lang)}`);
      return finish({ state, effects: [] });
    }
  }

  if (ai?.escalate && !draft) {
    const q = { id: `q${state.nextQuestionNo++}`, customerId, text: rawText.trim(), cookText: extra.cookText || null, kind: ai.escalate, status: 'open', at: now };
    state.ownerQueue.push(q);
    reply(say(ai.escalate === 'complaint' ? 'cComplaint' : 'cQuestionSent'));
    effects.push({ type: 'ownerQuestion', questionId: q.id });
    return finish({ state, effects: [] });
  }
  if (ai?.thanks && !draft) {
    reply(say('cThanks'));
    return finish({ state, effects: [] });
  }
  const text = ai?.ruleText || rawText;
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
      reply(say('cKeepFirst'));
      return finish({ state, effects: [] });
    }
    reply(say('cDupAgain'));
    return finish({ state, effects: [] });
  }

  // 2. Orders paused near closing
  if (state.ordersPaused && looksLikeOrder) {
    reply(say('cClosed'));
    return finish({ state, effects: [] });
  }

  // 2b. Ordering a dish that is not available today (switched off or sold out)
  const offItems = items.filter((i) => !available(state, state.menu.find((m) => m.id === i.itemId)));
  if (!draft && offItems.length) {
    reply(`${offItems.map((i) => availabilityLine(state, lang, i)).join('\n')}\n\n${menuText(state, lang)}`);
    return finish({ state, effects: [] });
  }

  // 3. Change to an existing order ("3 thali kar do")
  const active = activeOrdersFor(state, customerId);
  if (active.length && includesAny(text, CHANGE_WORDS) && extractNumbers(text).length) {
    const order = active[active.length - 1];
    const newQty = items.find((i) => i.qty)?.qty ?? extractNumbers(text).slice(-1)[0].value;
    effects.push({ type: 'orderChange', orderId: order.id, newQty, newTime: time });
    reply(say('cChangeSent'));
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
      if (normalize(rawText).length >= 6) d.address = rawText.trim();
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
        reply(say('cFirstOrder'));
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
    reply(say('cHello', { name: customer.name, menu: menuText(state, lang) }));
    if (customer.usual) reply(say('cUsual', { items: itemsLabel(state, [customer.usual], lang) }));
    return finish({ state, effects: [] });
  }
  if (includesAny(text, MENU_WORDS) || includesAny(text, PRICE_WORDS)) {
    reply(menuText(state, lang));
    return finish({ state, effects: [] });
  }
  if (includesAny(text, TIMING_WORDS)) {
    reply(hoursText(state, lang));
    return finish({ state, effects: [] });
  }

  // 7. A question only the owner can answer
  if (String(text).includes('?') || includesAny(text, QUESTION_WORDS)) {
    const q = { id: `q${state.nextQuestionNo++}`, customerId, text: rawText.trim(), cookText: extra.cookText || null, kind: 'question', status: 'open', at: now };
    state.ownerQueue.push(q);
    reply(say('cQuestionSent'));
    effects.push({ type: 'ownerQuestion', questionId: q.id });
    return finish({ state, effects: [] });
  }

  // 8. Unclear -> ask, never guess
  reply(say('cUnclear'));
  return finish({ state, effects: [] });

  function finish(res) {
    let out = res.state;
    const all = [...effects, ...res.effects];
    // "Answered for you": the app replied without needing the owner.
    if (all.some((e) => e.type === 'customerReply') && !all.some((e) => e.type === 'ownerQuestion')) {
      out = Object.assign(out, bump(out, 'answered', now));
    }
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
  const lang = customer.lang || state.lang;
  const say = (key, p) => line(lang, key, p);
  const ask = (field, t) => {
    d.awaiting = field;
    state.drafts[customer.id] = d;
    effects.push({ type: 'customerReply', customerId: customer.id, text: t });
    return { state, effects };
  };
  const missingQty = d.items.find((i) => !i.qty);
  if (missingQty) {
    return ask('qty', say('cHowMany', { item: itemName(state, missingQty.itemId, lang) }));
  }
  // Not more than what is left today
  const tooMany = d.items.find((i) => { const left = leftOf(state, state.menu.find((m) => m.id === i.itemId)); return left !== null && i.qty > left; });
  if (tooMany) {
    const m = state.menu.find((x) => x.id === tooMany.itemId);
    const left = leftOf(state, m);
    tooMany.qty = null;
    return ask('qty', say('cOnlyLeft', { n: left, item: dishName(state, m, lang) }));
  }
  if (!d.promised) return ask('time', say('cWhen'));
  if (!d.address && !customer.address) return ask('address', say('cAddress'));
  if (d.address && !customer.address) customer.address = d.address; // remember for next time

  // Duplicate: same items and time as an active order
  const dup = activeOrdersFor(state, customer.id).find((o) => sameItems(o.items, d.items) && o.promised?.label === d.promised.label);
  if (dup) {
    d.awaiting = 'duplicate';
    state.drafts[customer.id] = d;
    effects.push({ type: 'customerReply', customerId: customer.id, text: say('cDuplicate', { items: itemsLabel(state, d.items, lang), time: timeLabel(lang, d.promised) }) });
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
      { type: 'customerReply', customerId: customer.id, text: line(customer.lang || state.lang, 'cReceived') },
      { type: 'orderReady', orderId: order.id },
    ],
  };
}

export { itemsLabel };
