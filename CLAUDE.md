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
- **Speech in:** Wispr Flow REST API via `server/index.js` when `WISPR_API_KEY` is set (not yet tested with a
  real key); otherwise browser SpeechRecognition (hi-IN), labelled Demo. Typing is always available, labelled Demo.
- **Speech out:** browser speechSynthesis.
- **Tests:** `npm test` (33). CI builds and runs the Docker image on every push.
- **Brand:** navy `#0E1F38`, off-white `#F8F4EC`, ochre `#D48C2B` (waiting), green `#1E7F4F` (confirmed),
  red `#D8232A` only for no, stop and alerts. Fonts: Baloo 2 (display), Hind (body). Logo: `public/logo.png`
  (cropped from a screenshot; replace with the original file).

## Rules for working on this repo
- **Rules decide, speech only transcribes.** Keep decisions in `src/core/` as pure, tested functions.
- **No silent fallbacks.** Anything simulated or substituted is labelled "Demo" in the UI and listed in the README.
- **The app must start with no keys.** Never commit secrets.
- **Never fake a test pass.** Run `npm test` and `npm run build` before committing.
- Don't copy WhatsApp's own branding or assets; keep the chat a generic messaging look.
- **Talking to Sohan:** simple language, explain technical words, short answers. Ask before major changes.

## Next steps
1. Test with a real mic in Chrome (desktop and phone); tune the Hindi and Marathi word lists from what speech recognition actually returns.
2. Turn on the live link (Pages) and check the mic works there (HTTPS).
3. Wispr Flow API key: ask on the hackathon Discord; then test the Wispr path.
4. Write the 3-minute demo script and pitch deck (reuse `docs/hackathon/`).
5. Optional polish if time allows: voice menu setup, nicer mobile layout, an LLM classifier only when a key is set.
