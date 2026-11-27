# Nirhast: context for Claude Code

## Who and what
- Team **SayLess** (lead Sohan Bhadalkar, with Soumil Sinha and Sofian Chicktay).
- Scaler × Wispr Flow **"India Runs on Voice"** hackathon, **Round 2**: build a working voice-first prototype.
  Round 1 (idea, build prompt, impact) has passed. Theme: **Livelihoods and small business**.
- **Nirhast:** a hands-free kitchen assistant for home food businesses and tiffin services that take orders
  on WhatsApp. Focus city: Mumbai. Languages: mixed Hindi, Marathi and English.
- Round 1 texts: `docs/hackathon/` (the Activity 2 build prompt is the product spec).
- **Why things are the way they are: read `docs/DECISIONS.md`** (idea choice, product decisions, Round 2 scope).
- Voice design rules with research behind them: `docs/hackathon/voice-design-rules.md`.

## Round 2 submission (one shot, due 30 Nov 2026, 11:59 pm IST)
1. Public GitHub repo that **starts with one command (Docker) and without any secret keys**.
2. YouTube demo, max 3 minutes, showing the product working.
3. Pitch deck PDF: problem, users, what it depends on, launch plan.
4. Optional live link (bonus). GitHub Pages workflow exists; the owner must set Settings → Pages → Source: GitHub Actions.
Everything must stay public and working until 2 Dec. Results 2 Dec; finale 13 Dec.

## Current state (built 27 Nov)
- **Core flow works end to end:** customer chat (simulated WhatsApp) → order read aloud → cook says
  haan / nahi / "2 nahi, 3" → saved → customer gets "Order confirmed".
- **Also done:** error ladder (Phir boliye → Haan ya nahi boliye → buttons), undo within 15 s, quiet mode,
  "Ab kya banaun?" ranking, prep count, delivery updates, owner-only cancel with a phrase check,
  owner question queue, duplicates, changes after confirmation, closing warning.
- **Keys (all optional, in `.env`, never committed; template `.env.example`):** `WISPR_API_KEY`, `GROQ_API_KEY`, `SARVAM_API_KEY`.
  Never read `.env` (Sohan's rule). The server prints which services are on at start.
- **Speech in:** Wispr Flow if its key is set (not yet tested; API access needs approval), else Groq Whisper if
  `GROQ_API_KEY` is set (not yet tested with a real mic), else browser SpeechRecognition, labelled Demo. Typing always works (Demo).
- **Understanding:** with `GROQ_API_KEY`, an LLM only labels each message with a type (`server/ai.js`, prompt in
  `buildSortPrompt`); `src/core/intents.js` turns the label into words the rules understand. Rules still decide.
  Without the key: word rules only.
- **Speech out:** Sarvam `bulbul:v3` if `SARVAM_API_KEY` is set (tested), else browser speechSynthesis.
- **Translation:** Sarvam `mayura:v1` (`POST /api/translate`, cached). Before sorting: the AI gets original + English
  (original wins). Customer question → cook's language. Cook's answer → customer gets her words + translation
  ("auto-translated"), never the translation alone (short replies get mistranslated). Tested live.
- **Menu is the source of truth** (`src/core/menu.js`): Owner edits rows (name, price, available; empty = no limit,
  0 = not today). "menu dikhaiye" → full menu; "X hai aaj?" → yes/no (price, N left) then the full menu, even for
  dishes not on the menu ("paneer"); never sent to the cook. Orders above what is left are asked again.
  Replies are built from the rows by rules (prices can't be invented); the AI only spots which dishes were asked.
- **Saved today** (`src/core/metrics.js`): messages answered for you (real count), actions done by voice (real count),
  minutes saved (estimate: 60 s per message, 20 s per voice action).
- **Languages:** picker on the Start screen. English first, then Hindi and Marathi: screen text `src/ui/uiText.js`,
  spoken/sent lines `src/core/i18n.js`. Hindi/Marathi still need a native-speaker check.
- **Tests:** `npm test` (67). CI builds and runs the Docker image on every push.
- **UI (rebuilt 27 Nov from the team's Figma, style only):** phone-width column. **Only 2 screens for the cook (Sohan, 28 Nov: the cook is
  overwhelmed, keep it minimal):** Kitchen (start button + first-time language; under the mic: today's numbers and "saved today";
  orders read aloud, Yes/No/Later, what next, today's orders), Chat (simulated WhatsApp) and Owner (hours, owner
  questions, menu rows, language).
  No "Demo" tags, no tech/service names on the cook's screens. The **Chat tab (simulated WhatsApp) is always shown** (Sohan, 28 Nov: it is critical).
  Demo tools (typing box, AI labels, speaking-as, log, reset) appear only with `?demo=1`; how to demo: `DEMO.md`. Code: `src/ui/App.jsx`, `src/ui/styles.css`, `src/ui/icons.jsx` (SVG icons, no emoji).
  Content and features come from the spec, not the Figma.
- **Brand:** lavender `#B6AAF2` + black `#000000` on off-white `#FAF9F6`, white rounded cards, pill buttons.
  Status colours: ochre `#C98525` (waiting), green `#16A34A` (confirmed), red `#BA1A1A` only for no, stop and alerts.
  Fonts: Plus Jakarta Sans, with Hind as fallback for Devanagari. Logo: maroon mark on lavender, `public/logo.png`
  and `public/favicon.png` (made from a screenshot; replace with the original file for print or the deck).
- **Chat screen** uses a familiar WhatsApp-style chat layout (green header, beige background, green bubbles),
  as Sohan asked, but no WhatsApp logo or name as branding.

## Rules for working on this repo
- **Rules decide, speech only transcribes.** Keep decisions in `src/core/` as pure, tested functions.
- **No silent fallbacks, but no demo clutter in the cook's UI.** Anything simulated or substituted is listed in
  README.md and DEMO.md (not as labels in the app). Real problems the cook must act on (mic not working) still show.
- **Empathise with the cook:** before adding anything to a screen, ask whether a busy cook with wet hands needs it.
  Prefer fewer pages and fewer words.
- **The app must start with no keys.** Never commit secrets.
- **Never fake a test pass.** Run `npm test` and `npm run build` before committing.
- Don't use WhatsApp's logo, name as branding, or assets. A WhatsApp-style chat layout is fine (team decision, 27 Nov).
- **UI changes: discuss with Sohan first**, agree, then build. Use the UI UX Pro skill for UI work.
- **Never credit Claude in git:** commits under Sohan's identity, no `Co-Authored-By: Claude` or `Claude-Session` lines.
- **Talking to Sohan:** simple language, explain technical words, short answers. Ask before major changes.

## Next steps
1. Test with a real mic in Chrome (desktop and phone); tune the Hindi and Marathi word lists from what speech recognition actually returns.
2. Turn on the live link (Pages) and check the mic works there (HTTPS).
3. Wispr Flow API key: ask on the hackathon Discord; then test the Wispr path.
4. Write the 3-minute demo script and pitch deck (reuse `docs/hackathon/`).
5. Optional polish if time allows: voice menu setup, nicer mobile layout, an LLM classifier only when a key is set.
6. Next sprint plan: `docs/NEXT-SPRINT.md` (voice, AI types and languages are built; mic timing and database are open).
