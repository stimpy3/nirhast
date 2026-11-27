// Everything the app says (to the cook) or writes (to customers), in English first,
// then Hindi and Marathi. The rules pick a line by its key; the language comes from settings.

export const LANGS = [
  { id: 'en', label: 'English', native: 'English', speech: 'en-IN' },
  { id: 'hi', label: 'Hindi', native: 'हिन्दी', speech: 'hi-IN' },
  { id: 'mr', label: 'Marathi', native: 'मराठी', speech: 'mr-IN' },
];
export const LANG_IDS = LANGS.map((l) => l.id);
export const WEEKDAYS = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  hi: ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'],
  mr: ['रविवार', 'सोमवार', 'मंगळवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'],
};
export const safeLang = (lang) => (LANG_IDS.includes(lang) ? lang : 'en');

// ---------- times ----------
export function clockLabel(lang, { hour, minute = 0 }) {
  const h12 = ((hour + 11) % 12) + 1;
  const hm = minute ? `${h12}:${String(minute).padStart(2, '0')}` : `${h12}`;
  if (safeLang(lang) === 'en') return `${hm} ${hour < 12 ? 'am' : 'pm'}`;
  const part = hour < 12 ? 0 : hour < 16 ? 1 : hour < 19 ? 2 : 3;
  if (lang === 'hi') return `${['सुबह', 'दोपहर', 'शाम', 'रात'][part]} ${hm} बजे`;
  return `${['सकाळी', 'दुपारी', 'संध्याकाळी', 'रात्री'][part]} ${hm} वाजता`;
}
export function timeLabel(lang, promised) {
  return promised ? clockLabel(lang, promised) : '';
}

// ---------- menu names ----------
export function itemName(state, itemId, lang) {
  const m = state.menu.find((x) => x.id === itemId);
  if (!m) return itemId;
  return (m.names && m.names[safeLang(lang)]) || m.name.toLowerCase();
}
export function itemsText(state, items, lang) {
  return items.map((i) => `${i.qty} ${itemName(state, i.itemId, lang)}`).join(', ');
}

// ---------- lines ----------
const L = {
  en: {
    confirmAsk: (p) => `${p.name} ji, ${p.items}, ${p.time}. Yes?`,
    ownerQAsk: (p) => `${p.name} ji asks: ${p.q}?`,
    sayAgain: () => 'Please say that again.',
    yesOrNo: () => 'Please say yes or no.',
    useButtons: () => 'Please use the buttons.',
    askLater: () => 'I will ask later.',
    saved: () => 'Saved.',
    declined: () => 'Okay, declined.',
    phraseFail: () => 'The phrase did not match. Nothing changed.',
    quietAsk: (p) => `${p.min} minutes?`,
    menuAsk: (p) => `${p.dishes}, thali ${p.price}. Right?`,
    sendAnswer: (p) => `Send: "${p.a}"?`,
    sanity: (p) => `${p.n} thalis? Really?`,
    snoozed: () => 'Okay, I will ask in 5 minutes.',
    okay: () => 'Okay.',
    quietSet: (p) => `Okay, quiet for ${p.min} minutes.`,
    sent: () => 'Sent.',
    whatToSay: () => 'Then what should I say?',
    ordersPaused: () => 'New orders stopped.',
    keepOpen: () => 'Okay, orders stay open.',
    menuSaved: () => 'Menu saved.',
    sayMenuAgain: () => 'Okay, say the menu again.',
    undoLate: () => 'Too late to undo.',
    undone: () => 'Undone.',
    noConfirmed: () => 'No confirmed orders yet.',
    nextBatch: (p) => `First ${p.name} ji, ${p.time}. ${p.total} ${p.dish} together.`,
    nextOne: (p) => `First ${p.name} ji, ${p.time}. ${p.qty} ${p.dish}.`,
    whose: () => 'Whose order? Say the name.',
    noted: () => 'Noted.',
    ownerOnly: () => 'Only the owner can do this.',
    priceWhich: () => 'Price of which item? Say it again.',
    sayPhrase: () => 'Say the phrase shown on the screen.',
    cancelled: () => 'Cancelled.',
    refundNoted: () => 'Refund noted.',
    priceSet: (p) => `${p.item} is now ${p.price}.`,
    lateAlert: (p) => `${p.name} ji's order is due in ${p.min} minutes.`,
    newWork: (p) => `${p.n} new things to check.`,
    closingAsk: (p) => `${p.n} orders left. Stop new orders?`,
    // to customers
    cConfirmed: (p) => `Order confirmed: ${p.items}, by ${p.time}. Thank you!`,
    cDeclined: () => 'Sorry, we cannot take this order today.',
    cUndoConfirm: () => 'Sorry, the last confirmation was sent by mistake. We will confirm again soon.',
    cUndoDecline: () => 'Sorry, that was a mistake. We are checking your order again.',
    cCancelled: () => 'Your order has been cancelled.',
    cMenu: (p) => `Today's menu:
${p.items}

To order, write for example: "2 thali 1 pm".`,
    cHours: (p) => `The kitchen is open from ${p.open} to ${p.close}.`,
    cKeepFirst: () => 'Okay, only the first order stays.',
    cDupAgain: () => 'Do you want a second order too? Reply "yes" or "no".',
    cClosed: () => 'Sorry, orders are closed for today. Please order tomorrow.',
    cChangeSent: () => 'Your change has been sent to the kitchen. We will tell you once it is confirmed.',
    cFirstOrder: () => 'This is your first order. How many thalis, and at what time?',
    cHello: (p) => `Namaste ${p.name} ji! ${p.menu}`,
    cUsual: (p) => `Send your usual order? ${p.items}. Write "usual".`,
    cQuestionSent: () => 'Your question has been sent to the kitchen. You will get an answer soon.',
    cComplaint: () => 'Sorry about this. The owner will reply to you soon.',
    cThanks: () => 'Thank you!',
    cUnclear: () => 'Sorry, I did not understand. To order, write for example: "2 thali 1 pm".',
    cHowMany: (p) => `How many ${p.item}?`,
    cWhen: () => 'What time do you need it?',
    cAddress: () => 'Please send your delivery address.',
    cDuplicate: (p) => `This order already exists (${p.items}, ${p.time}). Do you want a second order too? "yes" or "no".`,
    cReceived: () => 'Order received. We will tell you once the kitchen confirms.',
    cPraise: () => 'Thank you! Glad you liked it.',
    cSuggestion: () => 'Thank you for the idea. We have told the owner.',
    cAskRating: () => 'How was the food today? Reply with a number from 1 to 5.',
    cRatingThanks: () => 'Thank you for rating us!',
    cRatingSorry: () => 'Sorry it was not good today. The owner will contact you.',
    forecastLine: (p) => `Today: about ${p.low}–${p.high} thali (usual ${p.weekday}). Busiest ${p.slot}.`,
    forecastNone: () => 'Not enough history yet for a forecast.',
    cYesItem: (p) => `Yes, ${p.item} is available today (₹${p.price}${p.left ? `, ${p.left}` : ''}).`,
    cNoItem: (p) => `Sorry, no ${p.item} today.`,
    cLeft: (p) => `${p.n} left`,
    cOnlyLeft: (p) => `Sorry, only ${p.n} ${p.item} left today. How many would you like?`,
    menuMorning: () => 'Good morning! What is on the menu today? Say, for example: aaj dal, aloo gobi, thali 120.',
    cTranslated: (p) => `${p.orig}
(${p.tr} · auto-translated)`,
  },
  hi: {
    confirmAsk: (p) => `${p.name} जी, ${p.items}, ${p.time}. हाँ?`,
    ownerQAsk: (p) => `${p.name} जी पूछ रहे हैं: ${p.q}?`,
    sayAgain: () => 'फिर से बोलिए।',
    yesOrNo: () => 'हाँ या नहीं बोलिए।',
    useButtons: () => 'बटन से बताइए।',
    askLater: () => 'बाद में पूछूँगी।',
    saved: () => 'सेव हो गया।',
    declined: () => 'ठीक है, मना कर दिया।',
    phraseFail: () => 'वाक्य मेल नहीं खाया। कुछ नहीं बदला।',
    quietAsk: (p) => `${p.min} मिनट?`,
    menuAsk: (p) => `${p.dishes}, थाली ${p.price}। सही?`,
    sendAnswer: (p) => `भेज दूँ: "${p.a}"?`,
    sanity: (p) => `${p.n} थाली? सच में?`,
    snoozed: () => 'ठीक है, 5 मिनट बाद पूछूँगी।',
    okay: () => 'ठीक है।',
    quietSet: (p) => `ठीक है, ${p.min} मिनट चुप रहूँगी।`,
    sent: () => 'भेज दिया।',
    whatToSay: () => 'तो क्या बोलूँ?',
    ordersPaused: () => 'नए ऑर्डर बंद।',
    keepOpen: () => 'ठीक है, ऑर्डर चालू रखती हूँ।',
    menuSaved: () => 'मेनू सेव हो गया।',
    sayMenuAgain: () => 'ठीक है, मेनू फिर से बोलिए।',
    undoLate: () => 'वापस करने में देर हो गई।',
    undone: () => 'वापस कर दिया।',
    noConfirmed: () => 'अभी कोई पक्का ऑर्डर नहीं।',
    nextBatch: (p) => `पहले ${p.name} जी, ${p.time}। ${p.total} ${p.dish} एक साथ।`,
    nextOne: (p) => `पहले ${p.name} जी, ${p.time}। ${p.qty} ${p.dish}।`,
    whose: () => 'किसका ऑर्डर? नाम बोलिए।',
    noted: () => 'नोट कर लिया।',
    ownerOnly: () => 'यह सिर्फ़ मालकिन कर सकती हैं।',
    priceWhich: () => 'किस चीज़ का दाम? फिर से बोलिए।',
    sayPhrase: () => 'स्क्रीन पर लिखा वाक्य बोलिए।',
    cancelled: () => 'कैंसल हो गया।',
    refundNoted: () => 'रिफ़ंड नोट कर लिया।',
    priceSet: (p) => `${p.item} अब ${p.price}।`,
    lateAlert: (p) => `${p.name} जी का ऑर्डर ${p.min} मिनट में देना है।`,
    newWork: (p) => `${p.n} नए काम।`,
    closingAsk: (p) => `${p.n} ऑर्डर बाकी। नए ऑर्डर बंद करूँ?`,
    cConfirmed: (p) => `ऑर्डर पक्का: ${p.items}, ${p.time} तक। धन्यवाद!`,
    cDeclined: () => 'माफ़ कीजिए, आज यह ऑर्डर नहीं ले पाएँगे।',
    cUndoConfirm: () => 'माफ़ कीजिए, पिछला कन्फ़र्मेशन गलती से गया। हम दोबारा कन्फ़र्म करके बताएँगे।',
    cUndoDecline: () => 'माफ़ कीजिए, गलती हुई। आपका ऑर्डर दोबारा देख रहे हैं।',
    cCancelled: () => 'आपका ऑर्डर कैंसल हो गया।',
    cMenu: (p) => `आज का मेनू:
${p.items}

ऑर्डर के लिए लिखिए, जैसे: "2 थाली 1 बजे"।`,
    cHours: (p) => `किचन ${p.open} से ${p.close} तक खुला है।`,
    cKeepFirst: () => 'ठीक है, पहला ऑर्डर ही रहेगा।',
    cDupAgain: () => 'दूसरा ऑर्डर भी चाहिए? "हाँ" या "नहीं" लिखिए।',
    cClosed: () => 'माफ़ कीजिए, आज के ऑर्डर बंद हो गए। कल ज़रूर ऑर्डर कीजिए।',
    cChangeSent: () => 'बदलाव किचन को भेज दिया। कन्फ़र्म होते ही बताएँगे।',
    cFirstOrder: () => 'आपका पहला ऑर्डर है। कितनी थाली, कितने बजे चाहिए?',
    cHello: (p) => `नमस्ते ${p.name} जी! ${p.menu}`,
    cUsual: (p) => `रोज़ वाला ऑर्डर भेजें? ${p.items}। "usual" लिखिए।`,
    cQuestionSent: () => 'आपका सवाल किचन को भेज दिया। जल्दी जवाब मिलेगा।',
    cComplaint: () => 'माफ़ कीजिए। मालकिन जल्दी आपको जवाब देंगी।',
    cThanks: () => 'धन्यवाद!',
    cUnclear: () => 'माफ़ कीजिए, समझ नहीं आया। ऑर्डर के लिए लिखिए, जैसे: "2 थाली 1 बजे"।',
    cHowMany: (p) => `कितनी ${p.item} चाहिए?`,
    cWhen: () => 'कितने बजे चाहिए?',
    cAddress: () => 'डिलीवरी का पता भेजिए।',
    cDuplicate: (p) => `यह ऑर्डर पहले से है (${p.items}, ${p.time})। दूसरा ऑर्डर भी चाहिए? "हाँ" या "नहीं"।`,
    cReceived: () => 'ऑर्डर मिल गया। किचन कन्फ़र्म करते ही बताएँगे।',
    cPraise: () => 'धन्यवाद! आपको अच्छा लगा, यह सुनकर खुशी हुई।',
    cSuggestion: () => 'सुझाव के लिए धन्यवाद। मालकिन को बता दिया है।',
    cAskRating: () => 'आज खाना कैसा लगा? 1 से 5 में नंबर लिखिए।',
    cRatingThanks: () => 'रेटिंग के लिए धन्यवाद!',
    cRatingSorry: () => 'माफ़ कीजिए, आज अच्छा नहीं लगा। मालकिन आपसे बात करेंगी।',
    forecastLine: (p) => `आज: लगभग ${p.low}–${p.high} थाली (आम ${p.weekday} की तरह)। सबसे व्यस्त ${p.slot}।`,
    forecastNone: () => 'अनुमान के लिए अभी पूरा इतिहास नहीं है।',
    cYesItem: (p) => `हाँ, आज ${p.item} है (₹${p.price}${p.left ? `, ${p.left}` : ''})।`,
    cNoItem: (p) => `माफ़ कीजिए, आज ${p.item} नहीं है।`,
    cLeft: (p) => `${p.n} बचे`,
    cOnlyLeft: (p) => `माफ़ कीजिए, आज सिर्फ़ ${p.n} ${p.item} बचे हैं। कितने चाहिए?`,
    menuMorning: () => 'सुप्रभात! आज मेनू में क्या है? ऐसे बोलिए: आज दाल, आलू गोभी, थाली 120।',
    cTranslated: (p) => `${p.orig}
(${p.tr} · अपने-आप अनुवाद)`,
  },
  mr: {
    confirmAsk: (p) => `${p.name} जी, ${p.items}, ${p.time}. हो?`,
    ownerQAsk: (p) => `${p.name} जी विचारत आहेत: ${p.q}?`,
    sayAgain: () => 'पुन्हा बोला.',
    yesOrNo: () => 'हो किंवा नाही बोला.',
    useButtons: () => 'बटण दाबा.',
    askLater: () => 'नंतर विचारते.',
    saved: () => 'सेव्ह झाले.',
    declined: () => 'ठीक आहे, नकार दिला.',
    phraseFail: () => 'वाक्य जुळले नाही. काहीही बदलले नाही.',
    quietAsk: (p) => `${p.min} मिनिटे?`,
    menuAsk: (p) => `${p.dishes}, थाळी ${p.price}. बरोबर?`,
    sendAnswer: (p) => `पाठवू: "${p.a}"?`,
    sanity: (p) => `${p.n} थाळ्या? खरंच?`,
    snoozed: () => 'ठीक आहे, 5 मिनिटांनी विचारते.',
    okay: () => 'ठीक आहे.',
    quietSet: (p) => `ठीक आहे, ${p.min} मिनिटे शांत राहते.`,
    sent: () => 'पाठवले.',
    whatToSay: () => 'मग काय सांगू?',
    ordersPaused: () => 'नवीन ऑर्डर बंद.',
    keepOpen: () => 'ठीक आहे, ऑर्डर चालू ठेवते.',
    menuSaved: () => 'मेनू सेव्ह झाला.',
    sayMenuAgain: () => 'ठीक आहे, मेनू पुन्हा सांगा.',
    undoLate: () => 'परत करायला उशीर झाला.',
    undone: () => 'परत केले.',
    noConfirmed: () => 'अजून एकही नक्की ऑर्डर नाही.',
    nextBatch: (p) => `आधी ${p.name} जी, ${p.time}. ${p.total} ${p.dish} एकत्र.`,
    nextOne: (p) => `आधी ${p.name} जी, ${p.time}. ${p.qty} ${p.dish}.`,
    whose: () => 'कोणाचा ऑर्डर? नाव सांगा.',
    noted: () => 'नोंद केली.',
    ownerOnly: () => 'हे फक्त मालकीण करू शकतात.',
    priceWhich: () => 'कशाचा दर? पुन्हा सांगा.',
    sayPhrase: () => 'स्क्रीनवर लिहिलेले वाक्य बोला.',
    cancelled: () => 'रद्द झाले.',
    refundNoted: () => 'रिफंडची नोंद केली.',
    priceSet: (p) => `${p.item} आता ${p.price}.`,
    lateAlert: (p) => `${p.name} जींचा ऑर्डर ${p.min} मिनिटांत द्यायचा आहे.`,
    newWork: (p) => `${p.n} नवीन कामे.`,
    closingAsk: (p) => `${p.n} ऑर्डर बाकी. नवीन ऑर्डर बंद करू?`,
    cConfirmed: (p) => `ऑर्डर नक्की: ${p.items}, ${p.time} पर्यंत. धन्यवाद!`,
    cDeclined: () => 'माफ करा, आज हा ऑर्डर घेता येणार नाही.',
    cUndoConfirm: () => 'माफ करा, आधीचे कन्फर्मेशन चुकून गेले. आम्ही पुन्हा कन्फर्म करून कळवू.',
    cUndoDecline: () => 'माफ करा, चूक झाली. तुमचा ऑर्डर पुन्हा पाहत आहोत.',
    cCancelled: () => 'तुमचा ऑर्डर रद्द झाला.',
    cMenu: (p) => `आजचा मेनू:
${p.items}

ऑर्डरसाठी लिहा, उदा.: "2 थाळी 1 वाजता".`,
    cHours: (p) => `किचन ${p.open} ते ${p.close} पर्यंत चालू आहे.`,
    cKeepFirst: () => 'ठीक आहे, पहिलाच ऑर्डर राहील.',
    cDupAgain: () => 'दुसरा ऑर्डरही हवा का? "हो" किंवा "नाही" लिहा.',
    cClosed: () => 'माफ करा, आजचे ऑर्डर बंद झाले. उद्या नक्की ऑर्डर करा.',
    cChangeSent: () => 'बदल किचनला पाठवला. नक्की झाल्यावर कळवू.',
    cFirstOrder: () => 'तुमचा पहिला ऑर्डर आहे. किती थाळ्या, किती वाजता हव्या?',
    cHello: (p) => `नमस्कार ${p.name} जी! ${p.menu}`,
    cUsual: (p) => `नेहमीचा ऑर्डर पाठवू? ${p.items}. "usual" लिहा.`,
    cQuestionSent: () => 'तुमचा प्रश्न किचनला पाठवला. लवकरच उत्तर मिळेल.',
    cComplaint: () => 'माफ करा. मालकीण लवकरच उत्तर देतील.',
    cThanks: () => 'धन्यवाद!',
    cUnclear: () => 'माफ करा, समजले नाही. ऑर्डरसाठी लिहा, उदा.: "2 थाळी 1 वाजता".',
    cHowMany: (p) => `किती ${p.item} हव्या?`,
    cWhen: () => 'किती वाजता हवे?',
    cAddress: () => 'डिलिव्हरीचा पत्ता पाठवा.',
    cDuplicate: (p) => `हा ऑर्डर आधीच आहे (${p.items}, ${p.time}). दुसरा ऑर्डरही हवा का? "हो" किंवा "नाही".`,
    cReceived: () => 'ऑर्डर मिळाला. किचनने नक्की केल्यावर कळवू.',
    cPraise: () => 'धन्यवाद! तुम्हाला आवडले याचा आनंद आहे.',
    cSuggestion: () => 'सूचनेबद्दल धन्यवाद. मालकिणींना सांगितले आहे.',
    cAskRating: () => 'आज जेवण कसे वाटले? 1 ते 5 मध्ये नंबर लिहा.',
    cRatingThanks: () => 'रेटिंगबद्दल धन्यवाद!',
    cRatingSorry: () => 'माफ करा, आज आवडले नाही. मालकीण तुमच्याशी बोलतील.',
    forecastLine: (p) => `आज: सुमारे ${p.low}–${p.high} थाळ्या (नेहमीच्या ${p.weekday} सारख्या). सर्वात गर्दी ${p.slot}.`,
    forecastNone: () => 'अंदाजासाठी अजून पुरेसा इतिहास नाही.',
    cYesItem: (p) => `हो, आज ${p.item} आहे (₹${p.price}${p.left ? `, ${p.left}` : ''}).`,
    cNoItem: (p) => `माफ करा, आज ${p.item} नाही.`,
    cLeft: (p) => `${p.n} शिल्लक`,
    cOnlyLeft: (p) => `माफ करा, आज फक्त ${p.n} ${p.item} शिल्लक आहेत. किती हवे?`,
    menuMorning: () => 'सुप्रभात! आज मेनूमध्ये काय आहे? असे सांगा: आज वरण, आलू गोबी, थाळी 120.',
    cTranslated: (p) => `${p.orig}
(${p.tr} · आपोआप भाषांतर)`,
  },
};
export const LINES = L;

export function line(lang, key, params = {}) {
  const fn = L[safeLang(lang)][key] || L.en[key];
  if (!fn) throw new Error(`Missing line: ${key}`);
  return fn(params);
}
