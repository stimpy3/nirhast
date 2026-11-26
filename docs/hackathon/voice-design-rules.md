# Nirhast: Final Rules for the Activity 2 Prompt

Use this as a checklist when you write or edit the prompt. Every rule should be true before you submit.

## The official rubric (from the Activity 2 form)
What the prompt should cover:
1. Your users: who they are, and the languages and accents they speak in.
2. The voice flow, step by step: what people say at each step, and what the product says or shows back.
3. When things go wrong: noise, accents, mixed languages and misheard input, and what the product does in each case.
4. Enough detail to build: specific enough that two builders would produce nearly the same prototype.

How it is evaluated:
- An AI check reads the prompt and checks it is a real prompt someone could give an AI app builder.
- Scoring weighs the voice flow most, then how you handle things going wrong and how buildable it is. (The form does not say which of those two counts more.)
- Up to 50 points toward the Round 1 total. 80 to 800 words.

Where each rubric point is covered below: users = section B; voice flow = sections C and C2; things going wrong = section D; buildable = sections A (rules 4 and 5), F and H.

## A. Form and scoring
1. Length: 760 to 795 words (limit is 80 to 800). Recount before submitting.
2. Use the form's four headings, exactly:
   - YOUR USERS AND THEIR LANGUAGES
   - THE VOICE FLOW, STEP BY STEP
   - WHAT THE PRODUCT SAYS OR SHOWS BACK
   - NOISE, ACCENTS, MIXED LANGUAGES AND MISHEARD INPUT
   Then one short BUILD DETAILS section.
3. Spend the most words on the voice flow, which the form says is weighted most. Then failure handling and build details.
4. Write it as instructions to a builder ("Build...", "When X, do Y"), never as a pitch.
5. Be exact enough that two builders make the same app: real numbers for timers, retries, word limits, times.
6. Match the Activity 1 idea. Nothing in the prompt should contradict it.
7. Dictate or read it through Wispr Flow before submitting.

## A2. The Goldilocks test (for you while writing, not text for the prompt)
- Describe what the app does, not what it understands.
- Every edge case must fit: "When X happens, the app says or does Y", with exact words or numbers.
- If an edge case needs the AI to be clever ("adapt to accents", "detect stress"), drop it or turn it into a fixed rule.
- Keep 1 to 2 rules per failure type the form names (noise, accents, mixed languages, misheard input): about 8 to 12 rules in total.
- Hard-code what the app does (its own lines, timers, retry counts, safety rules). Give examples of what users say, and let the AI classify; unclear always goes to the error ladder.
- Example: not "handle rushed speech", but "Classify the reply as yes, no or unclear (yes examples: haan, haan haan, ho, theek). If unclear, say 'Haan ya nahi boliye' once."

## B. Users and languages
8. Name the users: cook-owner, helper, delivery person, customers on WhatsApp text.
9. Languages: Hindi, Marathi, English, mixed. Name accents and pace: Marathi-accented Hindi, older or slow speakers, and rushed, clipped speech from a cook in a hurry ("haan haan", "theek", half words).
9a. Rushed speech: classify short or repeated replies ("haan haan", "ha", "theek") like any other reply; if unclear, use the error ladder, whose lines are short.
10. Include regional food words (kanda = pyaaz, poli = chapati = roti).

## C. Voice flow format
11. Every step shows three things: what the person SAYS, what Nirhast SAYS, what the screen SHOWS.
12. One question at a time. Spoken lines under 10 words.
13. Nirhast listens automatically for 6 seconds after each question. No button, no wake word needed while cooking.
14. Cover every agreed step: morning menu, automatic customer replies, new order, owner question, what to cook next, quiet mode with "10 minute?", closing warning, prep count, delivery update, owner-only action.
15. Respectful tone: "ji" and "aap" whenever addressing a person.
15a. Remember each customer's address and usual order; offer regulars their usual order.
15b. Reply within about 1 second; if something takes longer, say "ek second".

## C2. What the product says or shows back (its own heading in the prompt)
15c. A soft chime before every listening window.
15d. Screen states for every reply: "Sun rahi hoon", then the words heard, then "Saved".
15e. Every spoken line also appears as a large card on screen.
15f. Numbers are spoken as words and shown as digits ("teen, 3").
15g. Nirhast replies in the language the cook used.

## D. Failure handling (each needs its own line and a specific action)
17. Noise: listen only after the chime. Noise never counts as "haan": only a reply the AI classifies clearly as yes accepts an order; anything unclear goes to the error ladder.
18. Error ladder: 1st "Phir boliye". 2nd an example: "Haan ya nahi boliye". 3rd leave it pending on screen with Haan and Nahi buttons.
19. Accents and mixed language: the AI model classifies each reply as yes, no or unclear. Give examples, not a closed list: yes (haan, ho, hao, theek hai, chalega, yes), no (nahi, nako, no).
20. Numbers: read back quantity and time; treat पांच, 5 and ५ as the same; if a quantity is more than 3 times that customer's usual, confirm ("Das thali? Sach mein?").
21. Wait for 2 seconds of silence (instead of 1) before ending a reply when a number or correction is expected.
22. Stop speaking when the cook speaks; "ruko" stops Nirhast. Nirhast must not hear its own voice.
23. Undo: "Galat, wapas" within 15 seconds.
24. Unclear customer text: ask the customer, never guess.
25. Speech service failure: say so, show the buttons, keep the audio.
25a. Nothing heard: assume she didn't hear and repeat the question once.
25b. Don't add your own noise filter before speech-to-text; it usually lowers accuracy.

## E. Safety and honesty
26. Never confirm to the customer until the order is saved.
27. Never fail silently; always tell the cook what happened.
28. Explicit confirmation for accept, cancel, refund. Implicit ("noted") for delivery updates and prep count.
29. Owner-only: cancel, refund, price change, with a random-phrase check.

## F. Build details
29a. Screens: customer chat (simulated WhatsApp, labelled DEMO), kitchen screen (large text, mic state, quiet-mode badge), owner screen (menu, orders, customers, question queue, settings).
30. Rules decide (ranking, retries, timers, owner checks); the AI model only understands and phrases.
31. Speech-to-text: Wispr Flow API. Speech out: text-to-speech. Pass today's menu and customer names as vocabulary hints if the API supports it; if not, skip hints.
32. Simulate and label DEMO: WhatsApp chat (in one replaceable module), optional voice signatures ("Speaking as" switch), random-phrase check.
33. Offline: save locally, show "saved on phone, will sync", sync later.
34. No fallback, mock data or substitute service beyond what the prompt lists, without asking first.
35. Sample data: 6 dishes with prices, opening hours, 8 customers, 3 regulars. Paneer not on today's menu.
35a. Data: store menu (dish, price), opening and closing time, customers (phone, name, address, usual order), orders (items, quantity, promised time, status: new, confirmed, delivered, cancelled), owner question queue, and an action log (time, action, speaker).
35b. Customer messages: the AI sorts each message into greeting, menu, price, timing, order or other. Answer only from data the owner entered; never invent. If an order lacks quantity, time or address, ask the customer one question. Anything not answerable goes to the owner queue.
35c. Exact business rules: cooking order = earliest promised time, then smallest order, with the same dish grouped. "Baad mein" re-asks after 5 minutes. Late alert 10 minutes before the promised time. Closing warning 30 minutes before closing time.
35d. Tech: React web app, data saved in browser storage, sync simulated and labelled DEMO.
35e. Order edge cases: two orders arriving together are queued and read one at a time; the same order sent twice is flagged and the customer is asked; a change after confirmation is read to the cook as a change, not a new order.
35f. Privacy: data belongs only to this kitchen; nothing is shared.
35g. Out of scope: real payments, delivery routing, real WhatsApp connection, customer logins.

## H. Self-check loop (goes in the prompt, at the end)
36. Write 6 to 8 "Done when" checks in the prompt, each a testable pass or fail. Examples: "Hi" gets the menu; "paneer hai aaj?" goes to the owner queue; an order without an address makes Nirhast ask the customer; "haan" confirms an order and the customer sees it; an unclear reply follows the 3-step error ladder; quiet mode holds everything except a late-order alert; a helper cannot cancel an order; an offline order syncs later.
37. Tell the builder: after building, run every check, show a pass or fail table, fix each failure, and test again. Repeat until every check passes. Do not call the build done before that.
38. Tell the builder: never make a check pass by faking it (mock data, hard-coded answers, skipping a step). If a check cannot pass, stop and explain why.
39. Pass threshold for the builder: all checks pass. Any single failure means fix and retest.
39a. Also tell the builder to score its own build from 1 to 5 on three areas: voice flow, failure handling, and match to this prompt. Threshold: every area 4 or more. Below that, list the specific fixes, apply them, and score again.
39b. Prompt wording to use (about 60 words): "When done, run every check and show a pass/fail table. Then score the build 1 to 5 on voice flow, failure handling and match to this prompt. If any check fails or any score is below 4, list the fixes, apply them and repeat. Never fake a pass."

## G. Before you submit
Word budget guide: voice flow ~300 words, says/shows back ~60, failure handling ~170, build details ~150, self-check ~70.
40. Check every rule above.
41. Count the words.
42. Read it once aloud: if a line sounds vague, make it specific.

Research behind these rules: the doc "Voice AI for Indian Small Businesses: What Builders and Researchers Say".
