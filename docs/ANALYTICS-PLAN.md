# Plan: Analytics, forecast, customer feedback

Agreed 27 Nov 2026 (plan only, build later). Dropped for now: payments/udhaar, nudging regulars.

## 1. Pages in the final product: 3
1. **Kitchen** (front page): mic, today's numbers, time saved, **today's forecast (short)**, orders.
2. **Analytics** (new): graphs and the reasoning behind the forecast.
3. **Owner**: hours, menu rows, owner questions, language.

The **Chat** tab is a stand-in for WhatsApp. It goes away when real WhatsApp is connected.
Until then it stays, so the demo can show customer messages.

## 2. Foundation: a real database on the server
Everything below needs history across days, which the browser alone can't keep.
- **SQLite on the server** (one file, works inside the one-command Docker start, no key needed; a Docker volume keeps it).
- Tables (from `NEXT-SPRINT.md` section 5), plus two new ones:
  `feedback` (customer, order, sentiment, topics, text, time) and `daily_stats` (date, orders, dishes, minutes saved).
- The rules stay pure functions in `src/core/`; the server stores what they produce. The browser keeps a copy so it still
  works if the network drops.
- **Sample history:** 4–6 weeks of realistic orders and feedback so the graphs and forecast work in the demo.
  Listed as sample data in DEMO.md; one switch removes it.

## 3. Morning forecast
**Method (simple maths, explained, no black box):**
- For each dish: the average quantity on the **same weekday over the last 4 weeks**, with recent weeks counting more.
- Adjust with this week's trend (this week vs last week so far), capped at ±20%.
- After opening, update with today's orders so far ("ahead of usual by 4").
- Shown as a **range** (e.g. 22–28 thali), plus the busiest half hour and the expected note counts ("about 6 bina pyaaz").
- Less than 2 weeks of history → "Not enough history yet" (never a made-up number).

**Where it shows:**
- **Kitchen (short):** one line card: "Today: about 25 thali (usual Tuesday). Busiest 1–1:30 pm."
  Also spoken at opening, together with "What is on the menu today?".
- **Analytics (detailed):** the reasoning: "Last 4 Tuesdays: 22, 26, 24, 27 → about 25. This week is 5% busier."
  A small chart of those days, the forecast per dish, and how close past forecasts were (forecast vs actual).

## 4. Slot overload: dropped for now (later)
Decided 27 Nov: not in this build. When it comes back, **the cook decides** whether she can take an order; the app
only shows how busy that half hour already is (no fixed limit set by the owner that blocks or redirects orders).

## 5. Customer feedback and complaints (AI classification + guardrails)
### 5a. What changes in the AI prompt (`buildSortPrompt` in `server/ai.js`)
- **New customer types:** `praise` (likes the food or service), `complaint` (exists), `suggestion` (an idea or request
  for the future), `off_topic` (spam, forwards, anything not about the kitchen).
- **Every customer message** also gets:
  - `sentiment`: positive / neutral / negative;
  - `topics`: from a fixed list: taste, quantity, temperature, delay, delivery, price, hygiene, packaging,
    wrong_item, menu_variety, other.
- **A rule in the prompt:** feedback about the food, delivery, price or service is always in scope. It is never
  `unclear` or `off_topic`. Only things unrelated to the kitchen are `off_topic`.
- **Examples in the prompt** in Hindi, Marathi and English for praise, complaint and suggestion, so mixed language and
  sarcasm ("wah, aaj bhi thanda") are handled.

### 5b. What happens with each type (rules decide, replies are fixed sentences)
| Type | Reply to customer | Goes to |
|---|---|---|
| praise | Fixed line: "Thank you! Glad you liked it." | Analytics (positive) |
| complaint | Apology + "the owner will reply" (exists) | Owner queue + Analytics (negative, topics) |
| suggestion | "Thank you, we will tell the owner" | Owner queue (low priority) + Analytics |
| off_topic | No auto reply | Owner queue only if it looks important; otherwise ignored, counted |

### 5c. Guardrails for automatic replies
- The AI only labels; reply text always comes from fixed sentences and the menu rows (no prices or promises invented).
- **Never automatic:** refunds, discounts, compensation, blame. Complaints always reach the owner.
- Output is checked: type, sentiment and topics must be from the fixed lists; anything else = unclear.
- Low confidence (< 0.6) → treated as unclear; a complaint label is trusted even at lower confidence (safer to over-escalate).
- Abusive or threatening messages → owner only, no auto reply.
- "Ignore your instructions…" style messages are just text to label (they never change the rules).
- Every AI label is logged (message, label, confidence) so the team can audit mistakes.

### 5d. Optional: ask for feedback
After an order is marked delivered, one fixed message: "Khana kaisa laga? 1 se 5 likhiye." At most once a day per
customer. Gives real satisfaction numbers instead of only complaints. **Decided 27 Nov: yes, once a day per customer.**
The 1–5 reply is stored as feedback (4–5 positive, 3 neutral, 1–2 negative; 1–2 also goes to the owner queue as a complaint).

## 6. Analytics page: what's on it
1. **Today:** forecast vs actual so far; time saved.
2. **Orders per half hour:** bars, today vs a typical day for this weekday.
3. **Last 4 weeks:** orders per day (line), with the forecast shown dotted.
4. **Dishes:** top dishes this week (bars); days they sold out.
5. **Customer satisfaction:** % happy (praise vs complaints) per week; complaints per 100 orders;
   top complaint topics (bars); 3 recent quotes.
7. **Time saved:** minutes per day (bars), messages answered for you, done by voice.
8. **This week in 3 lines:** written by the LLM **only from the numbers above** (the numbers are given to it; any
   number in its text must match the data, or the summary is not shown).

Charts: simple SVG bars and lines in the app's colours (no heavy chart library). Use the dataviz guidance when building.

## 7. Build order and rough effort
| Step | What | Effort |
|---|---|---|
| 1 | SQLite on the server, state saved there, sample history | 1 day |
| 2 | Forecast logic (pure, tested) + Kitchen card + spoken at opening | ½ day |
| 3 | Feedback types, sentiment, topics in the prompt; storage; guardrail tests | ½ day |
| 4 | Analytics page with charts | 1 day |
| 5 | Weekly 3-line summary with number check | ½ day |

## 8. Open questions for Sohan
1. ~~Ask for a 1–5 rating after delivery?~~ Yes, once a day per customer (decided 27 Nov).
2. Keep the Chat tab until real WhatsApp is connected (current plan)?
