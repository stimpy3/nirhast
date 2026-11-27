import { describe, it, expect } from 'vitest';
import { createInitialState, customerSends, cookSays, noReply, pressButton, tick, setSpeakingAs } from '../src/core/store.js';
import { classifyReply, extractNumbers, parseTime, speakable } from '../src/core/text.js';

const T0 = new Date(2026, 10, 27, 12, 0, 0).getTime(); // 12:00 noon
const min = (m) => m * 60 * 1000;
const says = (effects) => effects.filter((e) => e.type === 'say').map((e) => e.text);
const replies = (effects) => effects.filter((e) => e.type === 'customerReply').map((e) => e.text);

function withOrder(text = '2 thali 1 baje', customer = 'c1', now = T0) {
  return customerSends(createInitialState(), customer, text, now);
}

describe('text rules', () => {
  it('classifies yes/no in Roman and Devanagari, rushed and repeated', () => {
    for (const t of ['haan', 'haan haan', 'ho', 'theek hai', 'chalega', 'हाँ', 'होय', 'ok']) expect(classifyReply(t).kind).toBe('yes');
    for (const t of ['nahi', 'nako', 'नहीं', 'no']) expect(classifyReply(t).kind).toBe('no');
  });
  it('treats noise and mixed signals as unclear, never yes', () => {
    for (const t of ['', 'hmm', 'arre wo', 'haan nahi', 'kya']) expect(classifyReply(t).kind).toBe('unclear');
  });
  it('reads corrections like "2 nahi, 3" and "do nahi teen"', () => {
    expect(classifyReply('2 nahi, 3')).toEqual({ kind: 'correction', value: 3 });
    expect(classifyReply('do nahi teen')).toEqual({ kind: 'correction', value: 3 });
    expect(classifyReply('नहीं, ३ थाली')).toEqual({ kind: 'correction', value: 3 });
  });
  it('treats पांच, 5 and ५ as equal', () => {
    expect(extractNumbers('पांच')[0].value).toBe(5);
    expect(extractNumbers('5')[0].value).toBe(5);
    expect(extractNumbers('५')[0].value).toBe(5);
    expect(extractNumbers('paanch')[0].value).toBe(5);
  });
  it('does not read "bhej do" as the number 2', () => {
    expect(extractNumbers('bhej do')).toEqual([]);
  });
  it('parses tiffin times', () => {
    expect(parseTime('1 baje')).toMatchObject({ hour: 13, label: '1 baje' });
    expect(parseTime('raat 8 baje')).toMatchObject({ hour: 20 });
    expect(parseTime('subah 9 baje')).toMatchObject({ hour: 9 });
  });
  it('speaks numbers as words', () => {
    expect(speakable('Sharma ji, 2 thali, 1 baje. Haan?')).toBe('Sharma ji, do thali, ek baje. Haan?');
  });
});

describe('Done-when checks from the build prompt', () => {
  it('"Hi" gets the menu', () => {
    const r = customerSends(createInitialState(), 'c4', 'Hi', T0);
    expect(replies(r.effects).join(' ')).toMatch(/Today's menu/);
  });

  // Changed 28 Nov (team decision): menu questions are answered from the owner's menu, not sent to the cook.
  it('"paneer hai aaj?" gets "no" and the full menu, without disturbing the cook', () => {
    const r = customerSends(createInitialState(), 'c2', 'paneer hai aaj?', T0);
    expect(replies(r.effects)[0]).toMatch(/^Sorry, no paneer today\.\n\nToday's menu:\n• Thali ₹120/);
    expect(r.state.ownerQueue).toHaveLength(0);
    expect(says(r.effects)).toEqual([]);
  });

  it('a question the menu cannot answer reaches the owner queue', () => {
    const r = customerSends(createInitialState(), 'c2', 'kal delivery jaldi ho sakti hai?', T0);
    expect(r.state.ownerQueue).toHaveLength(1);
    expect(says(r.effects).join(' ')).toMatch(/Gupta ji asks: kal delivery jaldi ho sakti hai\?/);
  });

  it('an order with no address triggers a question', () => {
    const r = customerSends(createInitialState(), 'c5', '2 thali 1 baje', T0);
    expect(replies(r.effects)).toContain('Please send your delivery address.');
    expect(r.state.orders).toHaveLength(0);
    const r2 = customerSends(r.state, 'c5', 'Room 12, Sai Darshan, Dadar', T0 + 1000);
    expect(r2.state.orders).toHaveLength(1);
    expect(r2.state.customers.find((c) => c.id === 'c5').address).toMatch(/Sai Darshan/); // remembered
  });

  it('"haan" confirms the order in the chat, only after saving', () => {
    const r = withOrder();
    expect(says(r.effects)).toContain('Sharma ji, 2 thali, 1 pm. Yes?');
    expect(r.state.chats.c1.some((m) => /confirmed/i.test(m.text))).toBe(false);
    const r2 = cookSays(r.state, 'haan', T0 + 2000);
    expect(r2.state.orders[0].status).toBe('confirmed');
    expect(replies(r2.effects)[0]).toMatch(/Order confirmed: 2 thali, by 1 pm/);
  });

  it('an unclear reply follows the ladder, then buttons', () => {
    let s = withOrder().state;
    let r = cookSays(s, 'arre wo', T0 + 1000);
    expect(says(r.effects)).toEqual(['Please say that again.']);
    r = cookSays(r.state, 'hmm', T0 + 2000);
    expect(says(r.effects)).toEqual(['Please say yes or no.']);
    r = cookSays(r.state, 'kya', T0 + 3000);
    expect(r.state.orders[0].status).toBe('pending');
    expect(r.state.dialog).toBeNull();
    r = pressButton(r.state, 'o1', 'yes', T0 + 4000);
    expect(r.state.orders[0].status).toBe('confirmed');
  });

  it('quiet mode holds everything except late alerts', () => {
    let s = createInitialState();
    let r = cookSays(s, 'abhi mat bolo', T0);
    expect(says(r.effects)).toEqual(['10 minutes?']);
    r = cookSays(r.state, 'haan', T0 + 1000);
    expect(r.state.quietUntil).toBe(T0 + 1000 + min(10));
    // A new order arrives during quiet: nothing is spoken
    r = customerSends(r.state, 'c1', '2 thali 1 baje', T0 + 2000);
    expect(says(r.effects)).toEqual([]);
    // A confirmed order nearing its time still alerts
    s = r.state;
    s.orders.push({ id: 'oX', no: 99, customerId: 'c2', items: [{ itemId: 'thali', qty: 1 }], promised: { hour: 12, minute: 8, label: '12:08 baje' }, status: 'confirmed', notes: [], createdAt: T0, alerted: false });
    r = tick(s, T0 + 3000);
    expect(says(r.effects).join(' ')).toMatch(/Gupta ji's order is due in \d+ minutes/);
    // After quiet ends, waiting work is announced and asked
    r = tick(r.state, T0 + 1000 + min(10) + 1);
    expect(says(r.effects).join(' ')).toMatch(/new things to check/);
    expect(says(r.effects).join(' ')).toMatch(/Sharma ji, 2 thali, 1 pm\. Yes\?/);
  });

  it('a helper cannot cancel; the owner needs the phrase check', () => {
    let r = withOrder();
    r = cookSays(r.state, 'haan', T0 + 1000);
    let s = setSpeakingAs(r.state, 'helper');
    r = cookSays(s, 'Sharma ka order cancel karo', T0 + 2000);
    expect(says(r.effects)).toEqual(['Only the owner can do this.']);
    expect(r.state.orders[0].status).toBe('confirmed');
    s = setSpeakingAs(r.state, 'owner');
    r = cookSays(s, 'Sharma ka order cancel karo', T0 + 3000);
    const phrase = r.effects.find((e) => e.type === 'showPhrase').phrase;
    r = cookSays(r.state, phrase, T0 + 4000);
    expect(r.state.orders[0].status).toBe('cancelled');
  });
});

describe('voice flow details', () => {
  it('"2 nahi, 3" updates the order and asks again', () => {
    let r = withOrder();
    r = cookSays(r.state, '2 nahi, 3', T0 + 1000);
    expect(says(r.effects)).toEqual(['Sharma ji, 3 thali, 1 pm. Yes?']);
    r = cookSays(r.state, 'haan', T0 + 2000);
    expect(r.state.orders[0].items[0].qty).toBe(3);
  });

  it('"baad mein" snoozes for 5 minutes', () => {
    let r = withOrder();
    r = cookSays(r.state, 'baad mein', T0 + 1000);
    expect(r.state.snoozed.o1).toBe(T0 + 1000 + min(5));
    r = tick(r.state, T0 + 1000 + min(5) + 1);
    expect(says(r.effects)).toContain('Sharma ji, 2 thali, 1 pm. Yes?');
  });

  it('nothing heard: repeat once, then the ladder', () => {
    let r = withOrder();
    r = noReply(r.state, T0 + 6000);
    expect(says(r.effects)).toEqual(['Sharma ji, 2 thali, 1 pm. Yes?']);
    r = noReply(r.state, T0 + 12000);
    expect(says(r.effects)).toEqual(['Please say that again.']);
  });

  it('asks "Sach mein?" when a regular orders over 3x their usual', () => {
    let r = withOrder('10 thali 1 baje', 'c2'); // Gupta usually orders 1
    r = cookSays(r.state, 'haan', T0 + 1000);
    expect(says(r.effects)).toEqual(['10 thalis? Really?']);
    expect(r.state.orders[0].status).toBe('awaiting');
    r = cookSays(r.state, 'haan', T0 + 2000);
    expect(r.state.orders[0].status).toBe('confirmed');
  });

  it('"Galat, wapas" within 15 s undoes and corrects the customer', () => {
    let r = withOrder();
    r = cookSays(r.state, 'haan', T0 + 1000);
    r = cookSays(r.state, 'galat wapas', T0 + 5000);
    expect(r.state.orders[0].status).toBe('awaiting');
    expect(replies(r.effects)[0]).toMatch(/sent by mistake/);
    expect(says(r.effects)).toContain('Undone.');
  });

  it('undo after 15 s is refused', () => {
    let r = withOrder();
    r = cookSays(r.state, 'haan', T0 + 1000);
    r = cookSays(r.state, 'galat wapas', T0 + 20000);
    expect(r.state.orders[0].status).toBe('confirmed');
  });

  it('"Ab kya banaun?" ranks by time, then size, and groups the same dish', () => {
    let s = createInitialState();
    let r = customerSends(s, 'c1', '2 thali 1 baje', T0);
    r = cookSays(r.state, 'haan', T0 + 1000);
    r = customerSends(r.state, 'c3', '4 thali 2 baje', T0 + 2000);
    r = cookSays(r.state, 'haan', T0 + 3000);
    r = cookSays(r.state, 'ab kya banaun', T0 + 4000);
    expect(says(r.effects)).toEqual(['First Sharma ji, 1 pm. 6 thali together.']);
  });

  it('prep count includes notes', () => {
    let r = customerSends(createInitialState(), 'c1', '2 thali 1 baje bina pyaaz', T0);
    r = cookSays(r.state, 'haan', T0 + 1000);
    r = cookSays(r.state, 'aaj kitne thali', T0 + 2000);
    expect(says(r.effects)).toEqual(['2 thali, 2 bina pyaaz.']);
  });

  it('delivery person marks delivered with "Noted"', () => {
    let r = withOrder();
    r = cookSays(r.state, 'haan', T0 + 1000);
    r = setSpeakingAs(r.state, 'delivery');
    r = cookSays(r, 'Sharma delivered', T0 + 2000);
    expect(says(r.effects)).toEqual(['Noted.']);
    expect(r.state.orders[0].status).toBe('delivered');
  });

  it('background talk with no open question is ignored, not acted on', () => {
    const r = cookSays(createInitialState(), 'arre beta khana kha lo', T0);
    expect(r.effects.some((e) => e.type === 'ignored')).toBe(true);
    expect(says(r.effects)).toEqual([]);
  });

  it('owner question: answer, read back, send on yes', () => {
    let r = customerSends(createInitialState(), 'c2', 'kal delivery jaldi ho sakti hai?', T0);
    r = cookSays(r.state, 'Nahi, kal milega', T0 + 1000);
    expect(says(r.effects)).toEqual(['Send: "Nahi, kal milega"?']);
    r = cookSays(r.state, 'haan', T0 + 2000);
    expect(replies(r.effects)).toEqual(['Nahi, kal milega']);
  });

  it('orders arriving together are read one at a time', () => {
    let r = customerSends(createInitialState(), 'c1', '2 thali 1 baje', T0);
    r = customerSends(r.state, 'c3', '3 thali 2 baje', T0 + 100);
    expect(says(r.effects)).toEqual([]); // second waits its turn
    r = cookSays(r.state, 'haan', T0 + 1000);
    expect(says(r.effects)).toEqual(['Saved.', 'Patil ji, 3 thali, 2 pm. Yes?']);
  });

  it('closing warning 30 minutes before close can pause new orders', () => {
    const late = new Date(2026, 10, 27, 21, 5).getTime();
    let r = tick(createInitialState(), late);
    expect(says(r.effects)).toEqual(['0 orders left. Stop new orders?']);
    r = cookSays(r.state, 'haan', late + 1000);
    expect(r.state.ordersPaused).toBe(true);
    r = customerSends(r.state, 'c1', '2 thali 9 baje', late + 2000);
    expect(replies(r.effects)[0]).toMatch(/orders are closed/);
  });
});

describe('customer messages', () => {
  it('asks for missing quantity, then time', () => {
    let r = customerSends(createInitialState(), 'c4', 'thali chahiye', T0);
    expect(replies(r.effects)).toEqual(['How many thali?']);
    r = customerSends(r.state, 'c4', '3', T0 + 1000);
    expect(replies(r.effects)).toEqual(['What time do you need it?']);
    r = customerSends(r.state, 'c4', '1 baje', T0 + 2000);
    expect(r.state.orders[0].items[0].qty).toBe(3);
  });

  it('regulars can reply "usual"', () => {
    const r = customerSends(createInitialState(), 'c1', 'usual 1 baje', T0);
    expect(r.state.orders[0].items).toEqual([{ itemId: 'thali', qty: 2 }]);
  });

  it('flags a duplicate order and asks', () => {
    let r = withOrder();
    r = customerSends(r.state, 'c1', '2 thali 1 baje', T0 + 1000);
    expect(replies(r.effects)[0]).toMatch(/already exists/);
    expect(r.state.orders).toHaveLength(1);
  });

  it('reads a change after confirmation as a change', () => {
    let r = withOrder();
    r = cookSays(r.state, 'haan', T0 + 1000);
    r = customerSends(r.state, 'c1', '3 thali kar do', T0 + 2000);
    expect(r.state.orders).toHaveLength(1);
    expect(says(r.effects)).toEqual(['Sharma ji, 3 thali, 1 pm. Yes?']);
  });

  it('unclear customer text gets one clear question', () => {
    const r = customerSends(createInitialState(), 'c4', 'blah blah', T0);
    expect(replies(r.effects)[0]).toMatch(/did not understand/);
  });
});

describe('times with minutes', () => {
  it('reads "1:30 baje" with its minutes', () => {
    expect(parseTime('1:30 baje')).toMatchObject({ hour: 13, minute: 30 });
    expect(parseTime('raat 8:15 baje')).toMatchObject({ hour: 20, minute: 15 });
  });
});
