import { describe, it, expect } from 'vitest';
import { createInitialState, customerSends, cookSays, tick, toggleToday, setHours, addItem, updateItem, removeItem, bump, savedToday } from '../src/core/store.js';
import { LINES, line, clockLabel } from '../src/core/i18n.js';
import { cookRuleText, customerRuleText, timeWords } from '../src/core/intents.js';
import { parseTime } from '../src/core/text.js';
import { buildSortPrompt, COOK_TYPES, CUSTOMER_TYPES } from '../server/ai.js';
import { UI } from '../src/ui/uiText.js';

const T0 = new Date(2026, 10, 27, 12, 0, 0).getTime();
const says = (effects) => effects.filter((e) => e.type === 'say').map((e) => e.text);
const replies = (effects) => effects.filter((e) => e.type === 'customerReply').map((e) => e.text);

// A cook line goes through the AI label -> rule words -> the same rules
function cookWithLabel(state, raw, sorted, now) {
  return cookSays(state, raw, now, cookRuleText(sorted, state));
}

describe('languages', () => {
  it('every spoken line and every screen label exists in English, Hindi and Marathi', () => {
    for (const lang of ['hi', 'mr']) {
      expect(Object.keys(LINES[lang]).sort()).toEqual(Object.keys(LINES.en).sort());
      expect(Object.keys(UI[lang]).sort()).toEqual(Object.keys(UI.en).sort());
    }
  });
  it('reads the order aloud in the chosen language', () => {
    for (const [lang, expected] of [['hi', 'Sharma जी, 2 थाली, दोपहर 1 बजे. हाँ?'], ['mr', 'Sharma जी, 2 थाळी, दुपारी 1 वाजता. हो?']]) {
      const r = customerSends(createInitialState(lang), 'c1', '2 thali 1 baje', T0);
      expect(says(r.effects)).toEqual([expected]);
    }
  });
  it('confirms to the customer in the app language', () => {
    let r = customerSends(createInitialState('hi'), 'c1', '2 thali 1 baje', T0);
    r = cookSays(r.state, 'हाँ', T0 + 1000);
    expect(replies(r.effects)[0]).toBe('ऑर्डर पक्का: 2 थाली, दोपहर 1 बजे तक। धन्यवाद!');
  });
  it('formats times per language', () => {
    expect(clockLabel('en', { hour: 20, minute: 30 })).toBe('8:30 pm');
    expect(clockLabel('hi', { hour: 9, minute: 0 })).toBe('सुबह 9 बजे');
    expect(clockLabel('mr', { hour: 13, minute: 0 })).toBe('दुपारी 1 वाजता');
    expect(line('en', 'saved')).toBe('Saved.');
  });
});

describe('AI labels go through the same rules', () => {
  it('time words read back to the same hour', () => {
    for (const hour of [9, 11, 12, 13, 17, 20, 21]) {
      expect(parseTime(timeWords({ hour, minute: 30 }))).toMatchObject({ hour, minute: 30 });
    }
  });

  it('cook: a "yes" label in any wording confirms', () => {
    const r0 = customerSends(createInitialState(), 'c1', '2 thali 1 baje', T0);
    const r = cookWithLabel(r0.state, 'haan bilkul bhej do bhai', { type: 'yes', confidence: 0.95 }, T0 + 1000);
    expect(r.state.orders[0].status).toBe('confirmed');
  });

  it('cook: low confidence falls back to the raw words (never a guessed yes)', () => {
    const r0 = customerSends(createInitialState(), 'c1', '2 thali 1 baje', T0);
    const r = cookWithLabel(r0.state, 'arre wo', { type: 'yes', confidence: 0.3 }, T0 + 1000);
    expect(r.state.orders[0].status).toBe('awaiting');
    expect(says(r.effects)).toEqual(['Please say that again.']);
  });

  it('cook: a change label updates the number', () => {
    const r0 = customerSends(createInitialState(), 'c1', '2 thali 1 baje', T0);
    const r = cookWithLabel(r0.state, 'teen bana do', { type: 'change_number', number: 3, confidence: 0.9 }, T0 + 1000);
    expect(r.state.orders[0].items[0].qty).toBe(3);
  });

  it('cook: "quiet for 5 minutes" sets quiet mode without asking', () => {
    const r = cookWithLabel(createInitialState(), 'paanch minute shanti', { type: 'quiet', minutes: 5, confidence: 0.9 }, T0);
    expect(r.state.quietUntil).toBe(T0 + 5 * 60000);
    expect(says(r.effects)).toEqual(['Okay, quiet for 5 minutes.']);
  });

  it('cook: cancel by label still needs the owner and the phrase check', () => {
    let r = customerSends(createInitialState(), 'c1', '2 thali 1 baje', T0);
    r = cookSays(r.state, 'haan', T0 + 1000);
    const s = { ...r.state, speakingAs: 'helper' };
    r = cookWithLabel(s, 'sharma wala hata do', { type: 'cancel', name: 'Sharma', confidence: 0.95 }, T0 + 2000);
    expect(says(r.effects)).toEqual(['Only the owner can do this.']);
    expect(r.state.orders[0].status).toBe('confirmed');
  });

  it('cook: unknown names are not trusted', () => {
    expect(cookRuleText({ type: 'delivered', name: 'Mehta', confidence: 0.9 }, createInitialState())).toBeNull();
  });

  it('customer: an order label in any wording becomes an order', () => {
    const s = createInitialState();
    const sorted = { type: 'new_order', items: [{ item: 'thali', qty: 2 }], time: { hour: 13, minute: 0 }, notes: ['bina pyaaz'], lang: 'en', confidence: 0.9 };
    const r = customerSends(s, 'c1', 'need two lunch boxes at 1, no onions please', T0, sorted);
    expect(r.state.orders).toHaveLength(1);
    expect(r.state.orders[0]).toMatchObject({ items: [{ itemId: 'thali', qty: 2 }], promised: { hour: 13 }, notes: ['bina pyaaz'] });
    expect(r.state.chats.c1[0].text).toBe('need two lunch boxes at 1, no onions please'); // chat keeps their words
  });

  it('customer: complaints and payment go to the owner', () => {
    for (const type of ['complaint', 'payment', 'special_request']) {
      const r = customerSends(createInitialState(), 'c2', 'khana thanda tha kal', T0, { type, lang: 'hi', confidence: 0.9 });
      expect(r.state.ownerQueue).toHaveLength(1);
      expect(r.state.ownerQueue[0].kind).toBe(type);
    }
  });

  it('customer: replies follow the customer language the AI detected', () => {
    const r = customerSends(createInitialState('en'), 'c4', 'नमस्कार', T0, { type: 'greeting', lang: 'mr', confidence: 0.9 });
    expect(replies(r.effects)[0]).toMatch(/^नमस्कार Deshmukh जी! आजचा मेनू/);
  });

  it('customer: address text is taken as written, not relabelled', () => {
    let r = customerSends(createInitialState(), 'c5', '2 thali 1 baje', T0);
    r = customerSends(r.state, 'c5', 'Room 12, Sai Darshan, Dadar', T0 + 1000, { type: 'unclear', confidence: 0.9 });
    expect(r.state.orders[0].address).toBe('Room 12, Sai Darshan, Dadar');
    expect(customerRuleText({ type: 'thanks', confidence: 0.9 }, createInitialState())).toEqual({ thanks: true });
  });
});

describe('sorting prompt', () => {
  it('lists every type and asks for JSON only', () => {
    const p = buildSortPrompt('cook', 'haan', { menu: [{ id: 'thali', names: ['thali'] }], customers: ['Sharma'], question: 'Sharma ji, 2 thali, 1 pm. Yes?' });
    for (const t of Object.keys(COOK_TYPES)) expect(p).toContain(`- ${t}:`);
    expect(p).toMatch(/Reply with JSON only/);
    const c = buildSortPrompt('customer', 'hi', {});
    for (const t of Object.keys(CUSTOMER_TYPES)) expect(c).toContain(`- ${t}:`);
  });
});

describe('translation between customer and cook', () => {
  it('reads a customer question to the cook in the app language', () => {
    const s = createInitialState('mr');
    const r = customerSends(s, 'c2', 'can you deliver to Bandra tomorrow?', T0, { type: 'question', lang: 'en', confidence: 0.9 }, { cookText: 'उद्या बांद्र्याला डिलिव्हरी कराल का?' });
    expect(says(r.effects)).toEqual(['Gupta जी विचारत आहेत: उद्या बांद्र्याला डिलिव्हरी कराल का?']);
    expect(r.state.ownerQueue[0].text).toBe('can you deliver to Bandra tomorrow?'); // original kept
  });

  it('sends the cook answer to the customer in their language, reads back her own words', () => {
    let r = customerSends(createInitialState('hi'), 'c2', 'can you deliver to Bandra tomorrow?', T0, { type: 'question', lang: 'en', confidence: 0.9 });
    r = cookSays(r.state, 'नहीं, कल मिलेगा', T0 + 1000, null, { answerForCustomer: 'No, it will be available tomorrow' });
    expect(says(r.effects)).toEqual(['भेज दूँ: "नहीं, कल मिलेगा"?']);
    r = cookSays(r.state, 'हाँ', T0 + 2000);
    expect(replies(r.effects)).toEqual(['No, it will be available tomorrow']);
  });

  it('the sorting prompt shows the English translation next to the original', () => {
    const p = buildSortPrompt('cook', '2 नहीं, 3', {}, 'not 2, 3');
    expect(p).toContain('Message: """2 नहीं, 3"""');
    expect(p).toMatch(/English translation .*trust the message.*"""not 2, 3"""/);
    expect(buildSortPrompt('cook', 'yes', {}, 'yes')).not.toMatch(/English translation/);
  });
});

describe("today's menu", () => {
  it('answers "is X there today?" from the menu, without the cook', () => {
    let s = toggleToday(createInitialState(), 'kanda-bhaji'); // switched off today
    let r = customerSends(s, 'c4', 'kanda bhaji milega aaj?', T0);
    expect(replies(r.effects)[0]).toMatch(/^Sorry, no Kanda bhaji today\.\n\nToday's menu:/);
    expect(replies(r.effects)[0]).not.toMatch(/Kanda bhaji ₹/);
    expect(r.state.ownerQueue).toHaveLength(0);
    r = customerSends(s, 'c4', 'dal hai aaj?', T0);
    expect(replies(r.effects)[0]).toMatch(/^Yes, Dal is available today \(₹60\)\.\n\nToday's menu:/);
    expect(says(r.effects)).toEqual([]); // the cook is not disturbed
  });

  it('"menu dikhaiye" sends the full menu; "paneer hai aaj, menu dikhaiye" answers first, then the menu', () => {
    let r = customerSends(createInitialState(), 'c2', 'menu dikhaiye', T0);
    expect(replies(r.effects)[0]).toMatch(/^Today's menu:\n• Thali ₹120\n• Dal ₹60/);
    r = customerSends(createInitialState(), 'c2', 'paneer hai aaj, menu dikhaiye', T0);
    expect(replies(r.effects)[0]).toMatch(/^Sorry, no paneer today\.\n\nToday's menu:/);
  });

  it('the AI label can name dishes not on the menu', () => {
    const sorted = { type: 'item_question', items: ['dal'], other: ['paneer'], lang: 'en', confidence: 0.9 };
    const r = customerSends(createInitialState(), 'c2', 'dal and paneer today?', T0, sorted);
    expect(replies(r.effects)[0]).toMatch(/^Yes, Dal is available today \(₹60\)\.\nSorry, no paneer today\./);
  });

  it('owner menu rows are the source of truth: new dish, price, stock', () => {
    let s = addItem(createInitialState());
    const id = s.menu[s.menu.length - 1].id;
    s = updateItem(s, id, { name: 'Paneer masala', price: 150, stock: 3 });
    let r = customerSends(s, 'c2', 'paneer masala hai aaj?', T0);
    expect(replies(r.effects)[0]).toMatch(/^Yes, Paneer masala is available today \(₹150, 3 left\)\./);
    expect(replies(r.effects)[0]).toMatch(/• Paneer masala ₹150 \(3 left\)/);
    // ordering more than is left asks again
    r = customerSends(s, 'c1', '5 paneer masala 1 baje', T0);
    expect(replies(r.effects)).toEqual(['Sorry, only 3 Paneer masala left today. How many would you like?']);
    r = customerSends(r.state, 'c1', '3', T0 + 1000);
    expect(r.state.orders[0].items).toEqual([{ itemId: id, qty: 3 }]);
    // now sold out
    r = customerSends(r.state, 'c4', 'paneer masala milega?', T0 + 2000);
    expect(replies(r.effects)[0]).toMatch(/^Sorry, no Paneer masala today\./);
    expect(removeItem(s, id).menu.some((m) => m.id === id)).toBe(false);
  });

  it('available 0 means not today', () => {
    const s = updateItem(createInitialState(), 'dal', { stock: 0 });
    expect(s.menu.find((m) => m.id === 'dal').today).toBe(false);
    expect(replies(customerSends(s, 'c4', 'dal hai aaj?', T0).effects)[0]).toMatch(/^Sorry, no Dal today/);
  });

  it('counts messages answered for you, and estimates time saved', () => {
    let r = customerSends(createInitialState(), 'c4', 'Hi', T0);
    r = customerSends(r.state, 'c4', 'dal hai aaj?', T0 + 1000);
    r = customerSends(r.state, 'c2', 'kal delivery jaldi ho sakti hai?', T0 + 2000); // goes to the owner: not counted
    let s = bump(r.state, 'handsFree', T0);
    s = bump(s, 'handsFree', T0);
    s = bump(s, 'handsFree', T0);
    expect(savedToday(s, T0)).toEqual({ answered: 2, handsFree: 3, buttons: 0, minutes: 3 });
    expect(savedToday(s, T0 + 24 * 3600 * 1000).answered).toBe(0); // a new day starts at zero
  });

  it('ordering a dish that is off today gets a polite no, not an order', () => {
    const s = toggleToday(createInitialState(), 'kanda-bhaji');
    const r = customerSends(s, 'c1', '2 kanda bhaji 1 baje', T0);
    expect(r.state.orders).toHaveLength(0);
    expect(replies(r.effects)[0]).toMatch(/no Kanda bhaji today/);
  });

  it('the voice menu switches dishes on and off', () => {
    let r = cookSays(createInitialState(), 'aaj dal aur roti thali 130', T0);
    r = cookSays(r.state, 'haan', T0 + 1000);
    const today = r.state.menu.filter((m) => m.today !== false).map((m) => m.id);
    expect(today).toEqual(['thali', 'dal', 'roti']);
    expect(r.state.menu.find((m) => m.id === 'thali').price).toBe(130);
  });

  it('asks for the menu once in the morning, after opening', () => {
    const s = setHours(createInitialState(), 'open', '10:00');
    const morning = new Date(2026, 10, 28, 10, 30).getTime();
    let r = tick(s, morning);
    expect(says(r.effects)).toEqual(['Good morning! What is on the menu today? Say, for example: aaj dal, aloo gobi, thali 120.']);
    r = tick(r.state, morning + 60000);
    expect(says(r.effects)).toEqual([]);
    expect(says(tick(s, new Date(2026, 10, 28, 9, 30).getTime()).effects)).toEqual([]); // not before opening
  });
});
