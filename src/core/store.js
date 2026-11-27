// Ties the customer side and the kitchen side together.
import { handleCustomerMessage } from './customerBot.js';
import * as kitchen from './kitchen.js';
import { SAMPLE_CUSTOMERS, SAMPLE_HOURS, SAMPLE_MENU } from './sampleData.js';

export function createInitialState(lang = 'en') {
  return {
    version: 1,
    lang, // app language: en | hi | mr (chosen on the Start screen)
    menu: structuredClone(SAMPLE_MENU),
    hours: structuredClone(SAMPLE_HOURS),
    customers: structuredClone(SAMPLE_CUSTOMERS),
    todayDishes: null,
    orders: [],
    ownerQueue: [],
    drafts: {},
    chats: {},
    snoozed: {},
    dialog: null,
    quietUntil: null,
    ordersPaused: false,
    closingWarned: false,
    lastAction: null,
    lastHeard: null,
    speakingAs: 'owner',
    log: [],
    nextOrderNo: 1,
    nextQuestionNo: 1,
  };
}

// A customer sends a WhatsApp message (simulated). Returns { state, effects }.
// `sorted` (optional) is the AI label for the message; rules still decide (see intents.js).
// `extra.cookText` (optional): the message translated into the app language, read to the cook if it becomes a question.
export function customerSends(prev, customerId, text, now, sorted = null, extra = {}) {
  const first = handleCustomerMessage(prev, customerId, text, now, sorted, extra);
  let state = first.state;
  const effects = [...first.effects];
  for (const e of first.effects) {
    let r = null;
    if (e.type === 'orderReady') r = kitchen.onOrderReady(state, e.orderId, now);
    if (e.type === 'ownerQuestion') r = kitchen.onOwnerQuestion(state, e.questionId, now);
    if (e.type === 'orderChange') r = kitchen.onOrderChange(state, e.orderId, e.newQty, e.newTime, now);
    if (r) { state = r.state; effects.push(...r.effects); }
  }
  return { state, effects };
}

export const cookSays = kitchen.onHeard;
export const noReply = kitchen.onNoReply;
export const pressButton = kitchen.onButton;
export const tick = kitchen.tick;
export const setSpeakingAs = kitchen.setSpeakingAs;
export function setLang(prev, lang) { return { ...prev, lang }; }

// Owner settings (pure): switch a dish on/off for today, set opening hours.
export function toggleToday(prev, itemId) {
  const menu = prev.menu.map((m) => (m.id === itemId ? { ...m, today: m.today === false } : m));
  return { ...prev, menu, menuSetOn: new Date().toDateString() };
}
export function setHours(prev, which, hhmm) {
  const [h, m] = String(hhmm).split(':').map((x) => parseInt(x, 10));
  if (!Number.isInteger(h) || h < 0 || h > 23 || !Number.isInteger(m)) return prev;
  return { ...prev, hours: { ...prev.hours, [which]: { hour: h, minute: m } }, closingWarned: false };
}
export { TIMING } from './kitchen.js';
export { updateItem, addItem, removeItem } from './menu.js';
export { bump, savedToday } from './metrics.js';
