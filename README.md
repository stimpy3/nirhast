# Nirhast: a hands-free kitchen assistant

Home cooks who run tiffin services take orders on WhatsApp. Today every order means stopping
cooking, wiping wet hands, unlocking the phone and scrolling chats. Orders get missed in the
lunch rush.

**Nirhast lets the cook run orders by voice.** Routine customer questions get answered
automatically, incomplete orders are completed with the customer, and only ready orders are read
aloud. The cook answers "haan", "nahi" or "2 nahi, 3" without touching the phone. The customer is
told "Order confirmed" only after the order is saved.

Built for the Scaler × Wispr Flow *India Runs on Voice* hackathon, Round 2 (theme: Livelihoods
and small business) by team **SayLess**.

---

## Run it (one command, no keys needed)

```bash
docker compose up --build
```

Open **http://localhost:8080/?demo=1** in **Chrome**, pick a language (**English, हिन्दी or मराठी**), tap
**Start kitchen** and allow the microphone. `?demo=1` adds the demo tools (a typing
box, AI labels); without it you see only what the cook sees. Step-by-step demo guide: [DEMO.md](DEMO.md).

Optional keys make each part better. Copy `.env.example` to `.env` and fill in any of them
(`.env` is never committed and never copied into the Docker image):

| Key | What it switches on | Without it |
|---|---|---|
| `WISPR_API_KEY` | Speech in through Wispr Flow | Groq Whisper if `GROQ_API_KEY` is set, else the browser's recognition |
| `GROQ_API_KEY` | An AI model sorts each message into a type; Groq Whisper speech in | Word rules only |
| `SARVAM_API_KEY` | Natural Hindi, Marathi and English voice (Sarvam Bulbul) and translation (Sarvam Mayura) | The browser's built-in voice; no translation |

The Start screen shows which ones are on. If a service fails or hits its rate limit, the app says so
and falls back to the no-key path; it never stops.

Without Docker (Node 22):

```bash
npm install
npm run build
npm start            # http://localhost:8080
```

Tests: `npm test` (50 tests).

---

## Try the core flow (2 minutes)

The cook sees two screens: **Kitchen** (orders read aloud, big Yes / No / Later buttons, what to cook next)
and **Owner** (today's numbers, owner questions, today's menu on/off, opening hours, language).
A third tab, **Chat**, simulates the customers' WhatsApp.

1. In **Chat** (as Sharma ji), send `2 thali 1 baje`, then open **Kitchen**.
2. Nirhast says: **"Sharma ji, 2 thali, 1 pm. Yes?"** (in Hindi: "Sharma जी, 2 थाली, दोपहर 1 बजे. हाँ?"),
   followed by a chime. It then listens for 6 seconds.
3. Say **"2 nahi, 3"**. It reads back **"Sharma ji, 3 thali, 1 pm. Yes?"**
4. Say **"haan"**. The order is saved and only then does the customer get *"Order confirmed: 3 thali, by 1 pm."*
5. Mumble something unclear three times. Nirhast says **"Please say that again"**, then **"Please say yes
   or no"**, then shows big **Yes / No** buttons.

With `GROQ_API_KEY` set, loose wording works too: a customer can write *"bhaiya 3 lunch box bhej dena
dedh baje tak"* and the cook can say *"chalo theek hai bana denge"*. The Kitchen screen shows the AI's
label next to what it heard (for example **AI: yes**).

No mic? With `?demo=1`, every step also works by typing in **"Demo: type what the cook says"**, or by
tapping the chips.

More to try:

| Say / send | What happens |
|---|---|
| Customer: `Hi` | Menu reply from the owner's data; regulars are offered their usual order |
| Customer: `paneer hai aaj?` / `dal hai aaj?` | Answered from the owner's menu rows: yes or no first (price, how many left), then the full menu. The cook is not disturbed |
| Customer: `menu dikhaiye` | The full menu from the owner's rows |
| Customer: `kal delivery jaldi ho sakti hai?` | The menu can't answer it, so it goes to the owner queue. Nirhast asks the cook, reads back her answer, then sends it |
| Customer (AI on): a complaint, payment question or special request | Goes straight to the owner queue, tagged by type |
| Customer (Khan ji): `2 thali 1 baje` | No saved address, so the customer is asked for it, and it is remembered |
| Customer: `usual 1 baje` | The regular's usual order |
| Customer, after confirming: `3 thali kar do` | Treated as a change, read to the cook again |
| Cook: `baad mein` | Asked again in 5 minutes |
| Cook: `ab kya banaun?` | "First Sharma ji, 1 pm. 7 thali together." (earliest time first, then smaller orders, same dish grouped) |
| Cook: `aaj kitne thali?` | Prep count, including notes like "bina pyaaz" |
| Cook: `abhi mat bolo` | "10 minutes?" Quiet mode: only late-order alerts interrupt. `abhi mat bolo 5 minute` sets 5 minutes directly |
| Cook: `galat, wapas` (within 15 s) | Undo; if the customer was already told, they get a correction |
| Delivery person: `Sharma delivered` | "Noted." |
| Helper: `Sharma ka order cancel karo` | "Only the owner can do this." The owner must repeat a random phrase shown on screen |
| Big order (Gupta ji usually orders 1): `10 thali 1 baje` | Extra check: "10 thalis? Really?" |

Snoozes, quiet mode, late alerts and the closing warning run on the real clock, so you have to wait to see them.

---

## How it works

```
Customer chat (simulated WhatsApp)          Kitchen (voice)
        │                                        ▲   │
        ▼                                        │   ▼
  customerBot.js  ── complete orders ──▶  kitchen.js (rules)  ◀── text ── speech in
  answers from owner data,                 ranking, timers,               (Wispr Flow, Groq Whisper
  asks for missing details,                retries, owner checks,          or browser recognition)
  owner-only questions -> queue            undo, quiet mode
        ▲                                        ▲      │
        └──── type label (optional AI: Groq) ────┘      └── lines (en/hi/mr) ──▶ speech out (Sarvam or
                                                                                 browser voice) + large cards
```

- **Rules decide, speech only transcribes.** Every decision (what counts as yes, the error ladder,
  timers, ranking, who may cancel) is a fixed rule in `src/core/`. A reply only counts as "yes" if it
  matches a yes word. Noise never does.
- **Mixed Hindi, Marathi and English.** Word lists cover Roman and Devanagari script
  ("haan" / "हाँ" / "ho" / "होय", "nahi" / "nako" / "नहीं"). Numbers work as digits, words or
  Devanagari (5 = paanch = पांच = ५). Times are understood as tiffin times ("1 baje" = 1 pm).
- **The AI only labels.** With a Groq key, each message gets one type (yes, no, change number,
  quiet, new order, complaint, ...). `src/core/intents.js` turns the type into the plain words the
  rules already understand, so the same tested rules still decide. Low confidence, unknown names or
  dishes, and odd numbers fall back to the raw words. The owner phrase check and free-text answers
  always use exactly what was said. Replies are fixed sentences, never AI-written. The prompt is in
  `server/ai.js` (`buildSortPrompt`).
- **Translation (Sarvam, when its key is set).** Before sorting, the message is translated to English
  and the AI sees **both** the original and the English; if they disagree, the original wins (a short
  reply like "2 nahi, 3" can come back as "Don't, do 3"). A customer question is translated into the
  cook's language before it is read out. The cook's answer is sent to the customer as **her own words
  plus the translation, marked auto-translated**, never the translation alone. Translations are cached.
  `TRANSLATE_BEFORE_SORT=false` switches off the English-first step.
- **One language for the app, English first.** Every screen label and every spoken or sent line is
  written in English and translated to Hindi and Marathi (`src/ui/uiText.js`, `src/core/i18n.js`).
  The cook picks the language on the Start screen. Customer replies follow the customer's own
  language when the AI detects it, otherwise the app language.
- **Save first, then confirm.** The customer is told only after the order is stored. Nothing fails silently.

### Speech in

| Mode | When | Notes |
|---|---|---|
| **Wispr Flow API** | `WISPR_API_KEY` set on the server | The browser records 16 kHz WAV segments using a simple voice-activity detector. A reply ends after 1 s of silence, or 2 s when a number or correction is expected. The server adds the key and calls `POST /api/v1/dash/api` with the chosen language first and the menu and customer names as `dictionary_context`. The key never reaches the browser. |
| **Groq Whisper** | `GROQ_API_KEY` set, no Wispr key | Same recorder; the server sends the WAV to Groq's `whisper-large-v3` with the chosen language and the menu and customer names as a spelling hint. |
| **Browser speech recognition** | No key (default) | Chrome's built-in recognition in the chosen language (`en-IN`, `hi-IN` or `mr-IN`). The browser decides when a phrase ends. |
| **Typing** | With `?demo=1` | For testing without a mic. |

Speech out uses Sarvam (`bulbul:v3`, voice `priya`) when `SARVAM_API_KEY` is set; the same line is
never paid for twice. Otherwise the browser's built-in voice in the chosen language. A soft chime marks
the start of each listening window.

---

## Analytics and forecast

The **Analytics** tab shows today's forecast with its reasoning (same weekday over the last 4 weeks, recent weeks
counting more, this week's trend), orders per half hour, thalis per day, top dishes, customer satisfaction and
complaint topics (from WhatsApp messages and a 1–5 rating asked after delivery), and minutes saved. Data is kept in a
SQLite database on the server (`data/`, a Docker volume). The first start adds 5 weeks of sample history
(`SAMPLE_HISTORY=false` to skip).

## What is real and what is demo

The cook's screens carry no demo labels (team decision: the cook is busy, the screen stays simple).
What is simulated is listed here and in [DEMO.md](DEMO.md), and the demo tools only appear with `?demo=1`:

- **WhatsApp is simulated.** It is one module (`customerBot.js` input/output), replaceable by the
  WhatsApp Business Cloud API, which needs Meta's approval to link a kitchen's own number.
- **"Speaking as" switch** (Owner screen, `?demo=1`) instead of voice profiles (recognising the speaker by voice is a later step).
- **Random-phrase owner check** for cancel, refund and price change.
- **Data stays in this browser** (localStorage). There is no sync.

Honest limits:

- **Without a Groq key, understanding uses word rules only.** They handle the listed examples and
  their variants. Unfamiliar phrasings get "Please say that again" rather than a guess. With the key,
  free-tier rate limits apply; when hit, the app says so and uses the word rules.
- **Half-duplex.** Nirhast does not listen while it speaks, so it never hears itself. To interrupt it, use
  the **Ruko** button, or say "ruko" once it has finished.
- **The Wispr Flow path is built to the published API but was not tested with a live key** (Wispr
  API access needs approval). Groq sorting and Sarvam voice were tested with live keys; Groq Whisper
  speech in was built to Groq's API but not yet tested with a real microphone.
- **Hindi and Marathi translations** are machine-written and still need a check by a
  native speaker.
- Payments, delivery routing and customer logins are out of scope.

---

## Project structure

```
src/core/text.js          yes/no/unclear rules, numbers (Hindi/Marathi/English/Devanagari), times
src/core/i18n.js          every spoken or sent line in English, Hindi and Marathi; times and dish names
src/core/intents.js       turns an AI type label into words the rules understand (with safety checks)
src/core/customerBot.js   customer messages: menu, prices, timings, orders, missing details, owner queue
src/core/kitchen.js       the voice dialog: confirm, correct, ladder, undo, quiet mode, alerts, owner checks
src/core/store.js         joins customer side and kitchen side
src/speech/               audio recorder + WAV encoder, browser recognition, Sarvam/browser voice, chime
src/ui/                   React screens (start, kitchen, customer chat, owner); uiText.js = screen text
server/index.js           serves the app; calls Wispr Flow, Groq and Sarvam only if their keys are set
server/ai.js              the sorting prompt and the Groq / Sarvam calls
tests/                    50 tests, including every "done when" check from our build prompt
```

## Tests

`npm test` runs the rules end to end with a fixed clock. It covers these "done when" checks:

- "Hi" gets the menu.
- "paneer hai aaj?" reaches the owner queue.
- A missing address triggers a question.
- "haan" confirms the order in the chat, only after saving.
- An unclear reply follows the ladder to buttons.
- Quiet mode holds everything except late alerts.
- A helper cannot cancel.

It also covers corrections, snooze, undo, ranking, prep count, duplicates, changes after
confirmation, the closing warning, the WAV format, every translation key in all three languages,
and AI labels going through the same rules (including "low confidence is never a yes").

## License

MIT

Sounds in `public/sounds/`: `mic_on.wav` and `mic_off.wav` were made by the team in code;
`notification_sound.mp3` and `complete_sound.mp3` are from Pixabay (Pixabay Content License).
