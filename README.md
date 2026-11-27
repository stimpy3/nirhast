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

Open **http://localhost:8080** in **Chrome**, tap the big mic button (**Tap to Start Kitchen**) and allow the microphone.

Optional: speech through the Wispr Flow API instead of the browser's own speech recognition:

```bash
WISPR_API_KEY=your_key docker compose up --build
```

Without Docker (Node 22):

```bash
npm install
npm run build
npm start            # http://localhost:8080
```

Tests: `npm test` (33 tests).

---

## Try the core flow (2 minutes)

The app has four tabs at the bottom: **Start**, **Kitchen Live**, **Chat** (a simulated WhatsApp chat) and **Owner**.

1. In **Chat** (as Sharma ji), send `2 thali 1 baje`, then open **Kitchen Live**.
2. Nirhast says: **"Sharma ji, 2 thali, 1 baje. Haan?"**, followed by a chime. It then listens for 6 seconds.
3. Say **"2 nahi, 3"**. It reads back **"Sharma ji, 3 thali, 1 baje. Haan?"**
4. Say **"haan"**. The order is saved and only then does the customer get *"Order confirmed: 3 thali, 1 baje tak."*
5. Mumble something unclear three times. Nirhast says **"Phir boliye"**, then **"Haan ya nahi boliye"**,
   then shows big **Haan / Nahi** buttons.

No mic? Every step also works by typing in **"Type what the cook says"** (labelled DEMO), or by
tapping the chips.

More to try:

| Say / send | What happens |
|---|---|
| Customer: `Hi` | Menu reply from the owner's data; regulars are offered their usual order |
| Customer: `paneer hai aaj?` | Not on today's menu, so it goes to the owner queue. Nirhast asks the cook, reads back her answer ("Bhej doon?"), then sends it |
| Customer (Khan ji): `2 thali 1 baje` | No saved address, so the customer is asked for it, and it is remembered |
| Customer: `usual 1 baje` | The regular's usual order |
| Customer, after confirming: `3 thali kar do` | Treated as a change, read to the cook again |
| Cook: `baad mein` | Asked again in 5 minutes |
| Cook: `ab kya banaun?` | "Pehle Sharma ji, 1 baje. 7 thali ek saath." (earliest time first, then smaller orders, same dish grouped) |
| Cook: `aaj kitne thali?` | Prep count, including notes like "bina pyaaz" |
| Cook: `abhi mat bolo` | "10 minute?" Quiet mode: only late-order alerts interrupt |
| Cook: `galat, wapas` (within 15 s) | Undo; if the customer was already told, they get a correction |
| Delivery person: `Sharma delivered` | "Noted." |
| Helper: `Sharma ka order cancel karo` | "Yeh sirf owner kar sakti hain." The owner must repeat a random phrase shown on screen |
| Big order (Gupta ji usually orders 1): `10 thali 1 baje` | Extra check: "10 thali? Sach mein?" |

The **+5 min (DEMO)** button moves the kitchen clock forward, so you can see snoozes, quiet mode,
late alerts and the closing warning without waiting.

---

## How it works

```
Customer chat (simulated WhatsApp)          Kitchen (voice)
        │                                        ▲   │
        ▼                                        │   ▼
  customerBot.js  ── complete orders ──▶  kitchen.js (rules)  ◀── text ── speech in
  answers from owner data,                 ranking, timers,               (Wispr Flow API or
  asks for missing details,                retries, owner checks,          browser recognition)
  owner-only questions -> queue            undo, quiet mode
                                                 │
                                                 └── lines ──▶ speech out (browser voice) + large cards
```

- **Rules decide, speech only transcribes.** Every decision (what counts as yes, the error ladder,
  timers, ranking, who may cancel) is a fixed rule in `src/core/`. A reply only counts as "yes" if it
  matches a yes word. Noise never does.
- **Mixed Hindi, Marathi and English.** Word lists cover Roman and Devanagari script
  ("haan" / "हाँ" / "ho" / "होय", "nahi" / "nako" / "नहीं"). Numbers work as digits, words or
  Devanagari (5 = paanch = पांच = ५). Times are understood as tiffin times ("1 baje" = 1 pm).
- **Numbers are spoken as words and shown as digits** ("teen", 3).
- **Save first, then confirm.** The customer is told only after the order is stored. Nothing fails silently.

### Speech in

| Mode | When | Notes |
|---|---|---|
| **Wispr Flow API** | `WISPR_API_KEY` set on the server | The browser records 16 kHz WAV segments using a simple voice-activity detector. A reply ends after 1 s of silence, or 2 s when a number or correction is expected. The server adds the key and calls `POST /api/v1/dash/api` with `language: ["hi","mr","en"]` and the menu and customer names as `dictionary_context`. The key never reaches the browser. |
| **Browser speech recognition** | No key (default) | Chrome's built-in recognition (`hi-IN`). Labelled **DEMO** in the app. The browser decides when a phrase ends. |
| **Typing** | Always available | Labelled **DEMO**, for testing without a mic. |

Speech out uses the browser's built-in voice (Hindi where available). A soft chime marks the start
of each listening window.

---

## What is real and what is demo

Clearly labelled **DEMO** in the app:

- **WhatsApp is simulated.** It is one module (`customerBot.js` input/output), replaceable by the
  WhatsApp Business Cloud API, which needs Meta's approval to link a kitchen's own number.
- **"Speaking as" switch** instead of voice profiles (recognising the speaker by voice is a later step).
- **Random-phrase owner check** for cancel, refund and price change.
- **Data stays in this browser** (localStorage). There is no sync.
- **The +5 min clock button.**

Honest limits:

- **Understanding uses word rules, not an AI model,** so the app runs with no secret keys. It handles
  the listed examples and their variants. Unfamiliar phrasings get "Phir boliye" rather than a guess.
- **Half-duplex.** Nirhast does not listen while it speaks, so it never hears itself. To interrupt it, use
  the **Ruko** button, or say "ruko" once it has finished.
- **The Wispr Flow path is built to the published API but was not tested with a live key** during
  development. The browser path and all the rules are tested.
- Payments, delivery routing and customer logins are out of scope.

---

## Project structure

```
src/core/text.js          yes/no/unclear rules, numbers (Hindi/Marathi/English/Devanagari), times
src/core/customerBot.js   customer messages: menu, prices, timings, orders, missing details, owner queue
src/core/kitchen.js       the voice dialog: confirm, correct, ladder, undo, quiet mode, alerts, owner checks
src/core/store.js         joins customer side and kitchen side
src/speech/               Wispr Flow recorder + WAV encoder, browser recognition, text-to-speech, chime
src/ui/                   React screens (kitchen, customer chat, owner)
server/index.js           serves the app; forwards audio to Wispr Flow only if WISPR_API_KEY is set
tests/                    33 tests, including every "done when" check from our build prompt
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
confirmation, the closing warning and the WAV format sent to Wispr Flow.

## License

MIT
