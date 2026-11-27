# Next sprint: plan for the next prototype

Written 27 Nov 2026 from team discussion.
**Status 27 Nov (evening): sections 1, 2 and 3 are built** (see "Built" under each). Sections 4 and 5 are still open.

## 1. The app's own voice (speech out)
- **Now:** the browser's built-in voice (`src/speech/tts.js`, speechSynthesis). Quality depends on the phone; the Hindi voice is often robotic and Marathi may be missing.
- **Wispr Flow does not do this.** Wispr Flow only turns speech into text (speech in). We need a separate text-to-speech service.
- **Plan:** add a text-to-speech service that speaks Hindi, Marathi and English well (options to compare: Sarvam AI, Google Cloud TTS, Azure). Use it only when its key is set; keep the browser voice as the no-key fallback, labelled Demo.
- **Built:** Sarvam `bulbul:v3` (voice `priya`) through `POST /api/speak` when `SARVAM_API_KEY` is set. It only reads the fixed reply text. Lines are cached so the same sentence is never paid twice. Browser voice is the fallback. Tested with a live key.

## 2. An AI model that sorts messages into types (no LLM today)
- **Now:** no LLM. Everything is word lists and rules (`src/core/text.js`, `src/core/kitchen.js`, `src/core/customerBot.js`). This works for known phrases but breaks on anything we didn't list.
- **Plan:** the AI model only **labels** a message with a type. Our rules still decide what happens and what reply is sent (fixed reply templates). The AI never sends free text to a customer or confirms an order.
- **Customer message types:** greeting, menu question, new order, change to an order, cancel request, address or delivery info, payment question, complaint, thanks or small talk, unclear.
- **Cook speech types:** yes, no, change number, later, stop, quiet for N minutes, what to cook next, prep count, delivered, cancel, unclear.
- **For each type, decide:** can the app answer by itself / does it need the cook's yes / must it go to the owner (escalate).
  Always escalate: complaints, refunds, special requests, anything about money, and anything unclear or with low confidence.
- If the AI is unsure, ask once more ("Phir boliye"), then fall back to buttons, as the error ladder does today.
- Runs only when an AI key is set. Without a key, the word lists stay as the fallback, labelled Demo.
- Add tests with real mixed-language examples for every type.
- **Built:** Groq, through `POST /api/sort` when `GROQ_API_KEY` is set. Cook speech uses `openai/gpt-oss-20b` (short, needs speed); customer chat uses `openai/gpt-oss-120b` (longer, more types). Both are settings in `.env`. The prompt is `buildSortPrompt` in `server/ai.js`. `src/core/intents.js` turns the label into words the rules understand; low confidence (< 0.6), unknown names or dishes fall back to the raw words. Complaints, payment, special requests and other questions go to the owner queue, tagged. Replies stay fixed sentences (no AI-written text). Groq Whisper is used for speech in when there is no Wispr key. Tested with a live key (about 0.7 s per label).
- **Still to do:** collect real mixed-language examples from testing and add them as tests; measure how often labels are wrong.

## 3. Start page with a language choice
- New first screen: pick **English, Hindi or Marathi**.
- **All app text written in plain English first**, kept in one translation file, then shown in the chosen language. Today the screens mix English and Hindi.
- The chosen language also sets the app's spoken replies and the speech-recognition language.
- The cook may still speak mixed languages (Hinglish, Marathi + Hindi); the app must still understand that.
- **Built:** language picker on the Start screen (and in Owner settings). Screen text: `src/ui/uiText.js`; spoken and sent lines: `src/core/i18n.js`; both in English, Hindi (Devanagari) and Marathi (Devanagari). A test checks every key exists in all three. Customer replies follow the customer's language when the AI detects it.
- **Still to do:** a native speaker checks the Hindi and Marathi text; Marathi browser voices are rare, so Marathi really needs Sarvam.

## 4. When the mic is on (the hardest problem)
- **Risk:** a mic left on hears the TV, the pressure cooker, helpers talking, phone calls and even the app's own voice. It can turn these into wrong commands. With Wispr Flow every sound clip is also an API call, which costs money.
- **Now:** the browser mic stays on all the time and pauses while the app speaks. The Wispr path cuts audio by loudness (a simple detector of when someone is talking).
- **Ideas to test:**
  - Listen properly only for a few seconds after the app asks a question (a short answer window).
  - Outside that window, react only to a wake word (for example "Nirhast") or a few commands (ruko, abhi mat bolo, ab kya banaun).
  - Ignore anything that isn't a known type (from section 2) instead of guessing.
  - Never act on a risky command (cancel, decline) from a noisy or low-confidence clip; always ask again.
  - Keep the big buttons as the backup at all times.
  - Test in a real noisy kitchen and measure wrong triggers.

## 5. Database and many kitchens
- **Now:** no database. All data (menu, orders, customers, chats) lives in the browser (localStorage), for one kitchen, with no login.
- **Round 2:** keep it that way. The demo must start with one command and no keys, and a database adds risk with 3 days left.
- **Next sprint:** add a database on the server. Use SQLite first (one file, works inside Docker, no key needed), then move to Postgres when hosted.
- Every table carries `kitchen_id`, so each kitchen sees only its own data.

| Table | Main fields |
|---|---|
| kitchens | id, name, owner phone, language, open and close times |
| users | id, kitchen_id, name, phone, role (owner / cook / helper) |
| menu_items | id, kitchen_id, name, other names the cook says (for speech), price, unit, available today (yes/no) |
| customers | id, kitchen_id, name, phone, address, usual order, notes |
| orders | id, kitchen_id, customer_id, status, due time, address, notes, created at, confirmed at, confirmed by |
| order_items | order_id, menu_item_id, quantity |
| messages | id, kitchen_id, customer_id, in or out, text, time, type (from section 2) |
| owner_questions | id, kitchen_id, customer_id, question, status, answer |
| action_log | id, kitchen_id, user_id, action, time, how (voice / button / typed), what was heard |

- Login: phone number + one-time code for the owner; the owner adds helpers. Roles decide who can cancel or change prices (today a "Speaking as" switch fakes this, labelled Demo).

## 6. Already listed elsewhere (still to do)
- Real mic test in Chrome (desktop and phone); tune the Hindi and Marathi word lists.
- Wispr Flow key from the hackathon Discord; test that path.
- Live link (GitHub Pages) and a mic check over HTTPS.
- 3-minute demo video and pitch deck PDF.
- Original logo file for print and the deck.
- Optional: set up the menu by voice; nicer phone layout.

## 6. "Saved by voice" metrics
**Built 28 Nov** as "saved today" on the Kitchen screen (answered for you, done by voice, minutes saved estimate).
Still open: reply speed and phone pick-ups saved. Original note: to motivate the owner to keep using voice. Honest metrics from the app's own data:
- Hands-free actions: orders confirmed by voice vs button (needs logging the input source per action).
- Reply speed: time from order to the cook's confirmation (Round 1 target: 80% of first replies within 2 min).
- Answered for you: menu, price, timing and "is X there today?" questions the app answered alone.
- Phone pick-ups saved: one per voice action, shown as an estimate.
