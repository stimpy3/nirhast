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
- **Activity 1 (idea):** the exact submitted text isn't saved here yet; ask Sohan to paste it into `docs/hackathon/`.
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
