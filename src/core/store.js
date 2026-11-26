// Ties the customer side and the kitchen side together.
import { handleCustomerMessage } from './customerBot.js';
import * as kitchen from './kitchen.js';
import { SAMPLE_CUSTOMERS, SAMPLE_HOURS, SAMPLE_MENU } from './sampleData.js';

export function createInitialState() {
  return {
    version: 1,
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
export function customerSends(prev, customerId, text, now) {
  const first = handleCustomerMessage(prev, customerId, text, now);
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
export { TIMING } from './kitchen.js';
