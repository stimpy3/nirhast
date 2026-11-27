# Demo guide

How to show Nirhast working, for the 3-minute video and for judges. The cook's screens stay clean;
everything here lives in this file, not in the app.

## Before you record

1. Put your keys in `.env` (see `.env.example`). For the best demo: `GROQ_API_KEY` and `SARVAM_API_KEY`.
2. Start the app: `docker compose up --build` (or `npm run build` then `npm start`).
3. Open **http://localhost:8080/?demo=1** in **Chrome** on a laptop. Use headphones off, speakers on, so the
   viewer hears Nirhast speak. Allow the microphone.
4. Owner tab → **Demo tools → Reset demo data**, so you start with no orders.
5. Check the small line under "Demo: type what the cook says" on the Kitchen tab. It should say
   `Speech in: groq • AI: Groq • Voice: Sarvam`. If it says `browser` or `word rules`, a key is missing.

`?demo=1` adds: a typing box with ready phrases on the
Kitchen tab, the AI's label next to what it heard (e.g. "AI: yes"), and on the Owner tab a "Speaking as"
switch, the action log and Reset.

## The 3-minute script

| Time | Show | Say / do |
|---|---|---|
| 0:00–0:20 | Owner tab | "Home tiffin cooks take orders on WhatsApp while cooking. Every message means stopping, wiping hands, picking up the phone." Show the menu rows; set **Kanda bhaji** available to **0**; add **Paneer masala ₹150, 3**. |
| 0:20–0:45 | Chat tab (Deshmukh ji) | Type `kanda bhaji milega aaj?` → instant reply "Sorry, no kanda bhaji today…". Type `paneer masala hai aaj?` → "Yes… (₹150, 3 left)" + full menu. Back on Kitchen, "saved today" went up. "The cook was not disturbed." |
| 0:45–1:30 | Chat (Sharma ji) → Kitchen | Type `bhaiya 3 lunch box bhej dena dedh baje tak`. Switch to Kitchen: Nirhast says "Sharma ji, 3 thali, 1:30 pm. Yes?". Say **"2 nahi, 3"** or **"haan"** out loud. Show the chat: "Order confirmed" arrived only after saving. |
| 1:30–2:00 | Kitchen | Say **"ab kya banaun?"** → it tells you what to cook first. Say **"abhi mat bolo 5 minute"** → quiet mode. |
| 2:00–2:30 | Chat (Gupta ji) in English, app in Marathi | Owner tab → language **मराठी**. Gupta ji types `Do you have paneer today?` → the cook hears it in Marathi. Answer `नाही, उद्या मिळेल`, then `हो` → the customer gets her words plus an English translation. |
| 2:30–3:00 | Kitchen | Owner tab → Speaking as **Helper**. Say `Sharma ka order cancel karo` → "Only the owner can do this." Close: "Rules decide, the AI only sorts. Nothing is confirmed until it is saved." |

Tip: if the mic struggles while recording, use the typing box. It runs exactly the same path as speech.

## What is simulated (say this if asked)

- **WhatsApp is simulated** (the Chat tab). The real version uses the WhatsApp Business Cloud API, which needs
  Meta's approval to connect a kitchen's own number.
- **"Speaking as"** stands in for recognising the speaker by voice.
- **Data stays in the browser** (no server database yet).
- **Speech in** uses Groq Whisper until Wispr Flow API access is approved; without keys, Chrome's own
  recognition. **Voice out** uses Sarvam; without a key, the browser's voice. **Understanding** uses the Groq
  LLM only to label messages; without a key, word rules. The app never stops if a service fails: it falls back
  and carries on.
- Hindi and Marathi screen text is machine-written and still needs a native-speaker check.

## Useful phrases

| Cook says | What happens |
|---|---|
| `haan` / `nahi` / `2 nahi, 3` / `baad mein` | confirm / decline / change number / ask again in 5 min |
| `ab kya banaun?` | what to cook first |
| `aaj kitne thali?` | prep count |
| `abhi mat bolo` (or `... 5 minute`) | quiet mode, only late alerts |
| `galat, wapas` (within 15 s) | undo |
| `Sharma delivered` | marks delivered |
| `aaj dal aur roti thali 130` | sets today's menu by voice |

| Customer writes | What happens |
|---|---|
| `Hi` | menu reply |
| `2 thali 1 baje` | order, read to the cook |
| `dal hai aaj?` / `kanda bhaji milega?` | answered from today's menu, cook not disturbed |
| `paneer hai aaj?` | "Sorry, no paneer today" + full menu |
| `menu dikhaiye` | the full menu from the Owner rows |
| `kal delivery jaldi ho sakti hai?` | the menu can't answer it, goes to the owner |
| `kal ka khana thanda tha` (AI on) | complaint, goes to the owner |
| `usual 1 baje` | the regular's usual order |
