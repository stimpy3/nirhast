# Decisions and reasoning (from the planning chat, 21–27 Nov 2026)

Read this to understand *why* Nirhast is built the way it is. Spec: `docs/hackathon/round1-activity2-build-prompt.txt`.
Voice design rules with research behind them: `docs/hackathon/voice-design-rules.md`.

## Why this idea
- **Rejected ideas:**
  - A shopkeeper voice credit ledger ("udhaar"): crowded, and the team didn't feel strongly about it.
  - Elderly-focused ideas: the team had no elderly testers.
  - Voiceprint as the core idea: too risky to build.
- **Picked:** home kitchens, tiffin services and small caterers that take orders on WhatsApp to avoid delivery-app commissions.
  The cook's hands are wet or oily during the lunch rush, so stopping to read WhatsApp means missed and mixed-up orders.
  Voice is a real need here, not a gimmick.
- **The name:** Nirhast (from "hands" / hands-free).

## Product decisions
- **Message routing:**
  1. Auto-answer what the owner's data covers (menu, price, timing).
  2. Ask customers for missing details (quantity, time, address) and never guess.
  3. Send questions only the owner can answer to an owner queue, read to the cook at calm moments.
  4. Only complete orders reach the kitchen.
- **Save first, then confirm.** The customer is told "confirmed" only after the order is saved. Nothing fails silently.
- **Error ladder:**
  1. "Phir boliye".
  2. "Haan ya nahi boliye".
  3. Leave it pending with big Haan/Nahi buttons.
- **Noise never counts as "yes".**
- **Quiet mode:** "Abhi mat bolo" → "10 minute?". Only late-order alerts break through. When it ends, the cook hears what's waiting.
- **Cooking order** ("Ab kya banaun?"): earliest promised time first, then smaller orders, same dish grouped.
- **Owner-only actions** (cancel, refund, price): a random-phrase check. Voice signatures are optional and shown as a "Speaking as" demo switch.
- **Customer memory:** remember each customer's address and usual order; regulars can reply "usual".
- **Language:** mixed Hindi, Marathi and English, Marathi-accented Hindi, rushed or clipped replies ("haan haan", "theek").
  Numbers work as digits, words and Devanagari (5 = paanch = पांच = ५). Numbers are spoken as words and shown as digits.
- **Listening:** the mic stays open, with no button and no wake word. A soft chime ends each question.
  The app waits up to 6 s for a reply to start; a reply ends after 1 s of silence (2 s when a number or correction is expected).
- **Barge-in:** "ruko" or the Ruko button stops Nirhast. It must never treat its own voice as input
  (the current build is half-duplex: it does not listen while speaking).

## Round 2 decisions (27 Nov)
- **Extend the Round 1 idea.** Theme: Livelihoods and small business. State: Maharashtra.
- **Scope = one core flow, end to end:** customer order → read aloud → haan / nahi / correction → saved → customer confirmed.
  Plus the error ladder. Everything else is a bonus. (The brief says "one core flow that works end to end, not a full product".)
- **WhatsApp is simulated** in a generic chat screen labelled Demo. Real WhatsApp would need Meta's approval
  and secret keys (not allowed), and the free test number reaches only 5 people. Don't copy WhatsApp's branding.
- **No secret keys at startup** (a rule):
  - Speech in uses the Wispr Flow API if `WISPR_API_KEY` is set, otherwise the browser's recognition (labelled Demo).
  - Understanding uses word rules, not an AI model, so it works with no key.
- **Web app (React), not a native app,** so it can be one link anyone opens, and run with one Docker command.
- **Brand:** navy, not red, as the main color, because red already means "no", "stop" and alerts in a kitchen UI.
  Red stays in the logo for light backgrounds. Colors and fonts are in CLAUDE.md.

## Round 1 results and texts
- All three activities passed. Each one had independent AI judges; scores were about 40–42/50 (prompt) and about 21/25 (impact).
- **Activity 1 (idea):** `docs/hackathon/round1-activity1-idea.txt` (problem, users, the voice-first product, why voice first). Reuse it in the deck.
- **Activity 3** set pilot targets (missed orders halve, phone pick-ups halve, 80% of first replies within 2 min,
  7 of 10 cooks keep using it), with a Mumbai sizing of about 7,000–14,000 daily home kitchens.
  Reuse these in the deck.

## Also running in parallel (not this repo)
- Perfios × Techfest IIT Bombay Agentic AI hackathon: the Round 1 abstract (no code), also due about 30 Nov.
  It is a separate product (voice distress detection in debt collection calls). Don't merge the two.

## UI decisions (27 Nov, evening)
- **First UI was dropped.** Sohan rebuilt the design direction in Figma; the code takes only its visual style
  (layout, cards, pills, bottom tab bar), never its content or features. Extra Figma content (revenue, stock,
  payment links, broadcast, "voice lock") is out of scope for Round 2.
- **Colours: lavender + black, as in the Figma.** This replaces the earlier navy brand. Status colours keep their
  meaning: ochre = waiting, green = confirmed only, red = no / stop / alerts only.
- **Chat screen: WhatsApp-style layout** instead of the Figma's chat, so judges instantly read it as WhatsApp.
  No WhatsApp logo or name as branding; labelled Demo.
- **Logo:** maroon "N" with a spoon on lavender.

## AI, voice and language decisions (27 Nov, night)
- **Services:** Wispr Flow for speech in when its key arrives (API access needs approval; the hackathon gives only the
  app, not API keys). Until then **Groq Whisper** for speech in, **Groq** LLM for sorting, **Sarvam** for the app's voice.
  Groq's own voices are English/Arabic only, so Sarvam does the speaking.
- **The AI only labels, it never replies.** Sohan wanted fixed replies plus an AI that sorts messages into types
  (greeting, order, complaint, ...), decides what the app can answer and what goes to the owner. The label is turned
  into words the existing rules understand, so the tested rules still decide. Replies stay fixed sentences.
- **Which model where:** the cook's voice loop needs speed, so it uses the smaller `gpt-oss-20b`; customer chat has
  more types and longer messages, so it uses `gpt-oss-120b`. Both are `.env` settings so the team can swap them.
- **Always escalate to the owner:** complaints, payment, special requests, questions the menu can't answer.
- **Languages:** English first, then Hindi and Marathi in Devanagari. The cook picks one on the Start screen;
  customer replies follow the customer's detected language. Translations need a native-speaker check.
- **Free-tier limits are enough for a 3-day demo** if prompts stay short; on a rate limit the app says so and uses
  word rules. Spoken lines are cached so Sarvam credits are not spent twice on the same sentence.
- **Database:** not for Round 2 (see `docs/NEXT-SPRINT.md` section 5).

## Translation decisions (27 Nov)
- **Translator: Sarvam (`mayura:v1`).** Google and Azure need a billing account with a card; Sarvam uses the key we
  already have (balance ₹958 on 27 Nov, about ₹20 per 10,000 characters).
- **English before the AI, but the original is kept.** Live test: "2 nahi, 3 kar do" → "Don't, do 3"; "kal ka khana
  thanda tha" → "the food for the day was cold". So the AI sees both and trusts the original.
- **Fixed replies are not translated live.** They are already written in all three languages.
- **Free text between people is translated:** customer question → cook's language; cook's answer → customer's
  language, always sent together with her own words and marked auto-translated ("नहीं, कल मिलेगा" came back as
  "No, I will meet you tomorrow").

## Simpler screens (27 Nov)
- **Kitchen, Chat and Owner.** Start moved into Kitchen (a big Start button; language only on first use).
  The simulated WhatsApp chat stays visible: it is how customer messages reach the kitchen in this prototype.
- **No "Demo" tags or service names (Groq, Sarvam) on screen.** The cook doesn't care. Demo tools sit behind
  `?demo=1` and the demo is explained in `DEMO.md`; simulated parts are listed in README and DEMO.md.
- **Today's menu is tap-to-switch on the Owner screen,** and the app asks for it by voice at opening time.
  Customers asking "dal hai aaj?" or "kanda bhaji milega?" get the answer from today's menu without disturbing
  the cook. A dish the kitchen never makes (paneer) still goes to the owner, as the spec says.
- **No separate profile page.** Opening hours and language live on the Owner screen.
- **Metrics card: later** (see `docs/NEXT-SPRINT.md` section 6).

## Menu rows and "saved today" (27 Nov)
- **Owner edits the menu as rows:** item, price, available quantity (empty = no limit, 0 = not today), add and remove.
  These rows are the only source for every menu answer on WhatsApp.
- **Menu questions never reach the cook.** "menu dikhaiye" gets the full menu. "paneer hai aaj?" gets a yes or no first
  (with price and how many are left), then the full menu. This replaces the spec's "paneer → owner queue" check
  (Sohan's call). Questions the menu can't answer (delivery, discounts) still go to the owner.
- **The reply text is built from the rows by rules, not written by the LLM,** so a price or dish can never be made up.
  The LLM only tells which dishes were asked about, including ones not on the menu.
- **"Saved today" on the Kitchen screen, under the mic,** with today's numbers (active, confirmed, waiting).
  Counts are real; minutes are an estimate (60 s per message answered, 20 s per action done by voice).

## Database, forecast, Analytics, feedback (28 Nov, night)
- **SQLite on the server** (built into Node, no new package; JSON file if unavailable). Sample history fills the first
  start so the demo has 5 weeks of data; it is listed in DEMO.md and can be switched off.
- **The forecast is not machine learning on purpose.** One kitchen has too little data for a trained model to beat a
  weighted average of the same weekday, and the cook can see why the number is what it is. ML is a next-sprint idea once
  real data from several weeks (and outside signals like holidays and rain) exists.
- **Analytics is a 3rd page** (Kitchen, Analytics, Owner; Chat until WhatsApp is real). "Regulars who stopped ordering"
  was removed at Sohan's request.
- **Feedback stays in scope:** the AI prompt says feedback about food, delivery, price or service is never off-topic;
  complaints are trusted at lower confidence (better to over-escalate); messages can't give the AI instructions.
