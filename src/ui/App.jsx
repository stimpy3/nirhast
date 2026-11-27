import React, { useEffect, useRef, useState } from 'react';
import { useNirhast } from './useNirhast.js';
import { itemsLabel } from '../core/customerBot.js';
import {
  MicIcon, MicOffIcon, StopIcon, ClockIcon, ForwardIcon, HomeIcon, ChatIcon, StoreIcon, SlidersIcon, UtensilsIcon,
  ArrowRightIcon, ChevronIcon, SendIcon, CheckCircleIcon, DoubleCheckIcon, EarIcon, InfoIcon, ShieldIcon, HistoryIcon,
  UsersIcon, QuestionIcon, MoreIcon, ArrowLeftIcon,
} from './icons.jsx';

const COOK_PHRASES = ['haan', 'nahi', '2 nahi, 3', 'baad mein', 'ab kya banaun?', 'aaj kitne thali?', 'abhi mat bolo', 'galat, wapas', 'Sharma delivered'];
const CUSTOMER_PHRASES = ['Hi', '2 thali 1 baje', 'paneer hai aaj?', 'usual 1 baje', '3 thali kar do', 'kab tak khula hai?'];
const TABS = [
  ['start', 'Start', MicIcon],
  ['kitchen', 'Kitchen Live', HomeIcon],
  ['chat', 'Chat', ChatIcon],
  ['owner', 'Owner', StoreIcon],
];
const MODE = { start: 'Setup', kitchen: 'Live', chat: 'Demo', owner: 'Owner' };
const ACTIVE = ['awaiting', 'pending', 'confirmed'];

function timeOf(ms) {
  return new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}
const minutesOf = (o) => (o.promised ? o.promised.hour * 60 + (o.promised.minute || 0) : 9999);
const customerOf = (state, id) => state.customers.find((c) => c.id === id);

export default function App() {
  const n = useNirhast();
  const [tab, setTab] = useState('start');
  const startKitchen = async () => { setTab('kitchen'); await n.start(); };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="logo" src="./logo.png" alt="" width="36" height="36" />
          <span className="brand-name">Nirhast</span>
          <span className="pill pill-mode">
            {tab === 'kitchen' && n.started && <span className="dot live" />}
            {MODE[tab]}
          </span>
        </div>
        <div className="top-right">
          <span className="pill pill-clock" title="Kitchen clock"><ClockIcon size={14} />{timeOf(n.now)}</span>
          <button className="pill pill-demo-btn" onClick={() => n.skipMinutes(5)} title="Demo: move the kitchen clock forward 5 minutes">
            <ForwardIcon size={14} />+5m<span className="sr-only"> (Demo)</span>
          </button>
        </div>
      </header>

      <main>
        {tab === 'start' && <StartScreen n={n} onStart={startKitchen} goKitchen={() => setTab('kitchen')} />}
        {tab === 'kitchen' && <KitchenScreen n={n} goStart={() => setTab('start')} />}
        {tab === 'chat' && <ChatScreen n={n} />}
        {tab === 'owner' && <OwnerScreen n={n} />}
      </main>

      <nav className="tabbar" aria-label="Screens">
        {TABS.map(([id, label, Icon]) => (
          <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}>
            <Icon size={22} />{label}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ---------------- 0. Start ----------------
function StartScreen({ n, onStart, goKitchen }) {
  const wispr = n.config.wispr;
  return (
    <div className="screen">
      <section className="card start-hero">
        <h1>Start Kitchen Session</h1>
        <p className="hi">रसोई शुरू करें • Voice kitchen</p>
        <div className="info-box">
          <strong><EarIcon size={18} />Always-on kitchen listening</strong>
          <p>Mic stays open. No button, no wake word. Nirhast asks one question at a time and waits 6 seconds for your reply.</p>
        </div>
        <p className="muted small" style={{ textAlign: 'left' }}>The browser needs one tap to allow the mic and Nirhast's voice.</p>
        {n.started ? (
          <>
            <p className="big-mic-label">Kitchen chal raha hai</p>
            <button className="btn-black" onClick={goKitchen}>Kitchen Live kholo <ArrowRightIcon size={18} /></button>
          </>
        ) : (
          <>
            <button className="big-mic" onClick={onStart} aria-label="Tap to start kitchen"><MicIcon size={40} /></button>
            <p className="big-mic-label">Tap to Start Kitchen (शुरू करें)</p>
          </>
        )}
        <p className="ready-line"><span className="dot live" />{n.config.checked ? 'Ready' : 'Checking…'} • Works best in Chrome</p>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title"><SlidersIcon />Speech engine</h2>
          <span className="tag ok"><span className="dot" />{n.config.checked ? 'Ready' : 'Checking'}</span>
        </div>
        <p className="label" style={{ marginBottom: 10 }}>Speech recognition</p>
        <div className={`engine ${wispr ? 'on' : ''}`}>
          <div><b>Wispr Flow</b><span>{wispr ? 'API key set on the server' : 'Not set up (no API key on the server)'}</span></div>
          {wispr && <CheckCircleIcon />}
        </div>
        <div className={`engine ${!wispr ? 'on' : ''}`}>
          <div><b>Browser speech <span className="tag demo">Demo</span></b><span>Chrome's built-in recognition (hi-IN)</span></div>
          {!wispr && <CheckCircleIcon />}
        </div>
        <p className="muted small" style={{ marginTop: 10 }}>Nirhast speaks with the browser's own voice. Typing is always available as a Demo backup.</p>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title"><UsersIcon />The voice flow</h2>
          <span className="tag lav">3 steps</span>
        </div>
        <div className="steps">
          <div className="step"><span className="step-num">1</span><div><b>Customer texts on WhatsApp</b><p>Nirhast answers menu, price and timing, and asks for anything missing. It never guesses.</p></div></div>
          <div className="step"><span className="step-num">2</span><div><b>Read aloud to the cook</b><p>Only complete orders, one at a time.</p><span className="quote">“Sharma ji, 2 thali, 1 baje. Haan?”</span></div></div>
          <div className="step"><span className="step-num">3</span><div><b>Cook says “Haan”</b><p>The order is saved first, then the customer gets “Order confirmed”.</p></div></div>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title" style={{ marginBottom: 6 }}><InfoIcon />If the mic doesn't work</h2>
        <p className="muted small" style={{ lineHeight: 1.5 }}>Mic blocked or kitchen too loud? Nirhast says “Abhi sun nahi pa rahi” and shows big Haan / Nahi buttons. Nothing fails silently.</p>
      </section>
    </div>
  );
}

// ---------------- 1. Kitchen Live ----------------
const MIC = {
  listening: ['Sun rahi hoon', 'Listening', ''],
  speaking: ['Bol rahi hoon', 'Speaking', 'speaking'],
  paused: ['Ruki hui', 'Paused', 'off'],
  typed: ['Typing mode', 'No mic here', 'off'],
  error: ['Mic nahi chal raha', 'Mic error', 'error'],
  off: ['Band', 'Kitchen not started', 'off'],
};

function KitchenScreen({ n, goStart }) {
  const { state } = n;
  const [simOpen, setSimOpen] = useState(true);
  const [typed, setTyped] = useState('');
  const quiet = Boolean(state.quietUntil);
  const quietMin = quiet ? Math.max(0, Math.ceil((state.quietUntil - n.now) / 60000)) : 0;
  const [micLabel, micSub, micCls] = quiet && n.mic !== 'error' ? ['Quiet mode', `${quietMin} min`, 'off'] : (MIC[n.mic] || MIC.off);
  const dialog = state.dialog;
  const dialogOrder = dialog?.kind === 'confirm' ? state.orders.find((o) => o.id === dialog.orderId) : null;
  const pending = state.orders.filter((o) => o.status === 'pending');
  const board = state.orders
    .filter((o) => o.id !== dialogOrder?.id && o.status !== 'pending')
    .sort((a, b) => rank(a) - rank(b) || minutesOf(a) - minutesOf(b));
  const nextUp = state.orders.filter((o) => o.status === 'confirmed').sort((a, b) => minutesOf(a) - minutesOf(b))[0];
  const activeCount = state.orders.filter((o) => ACTIVE.includes(o.status)).length;
  const doneCount = state.orders.filter((o) => o.status === 'delivered').length;
  const say = (t) => n.handleCookText(t, 'typed');
  const submit = (e) => { e.preventDefault(); if (typed.trim()) { say(typed); setTyped(''); } };

  const kind = n.line?.kind;
  const status = dialogOrder ? ['wait', 'Waiting for confirmation']
    : kind === 'saved' ? ['ok', 'Saved']
      : kind === 'alert' ? ['red', 'Alert']
        : dialog ? ['wait', 'Jawab ka intezaar'] : ['lav', 'Nirhast'];
  const yesNo = dialog && dialog.kind !== 'phrase' && !(dialog.kind === 'ownerQ' && dialog.stage === 'answer');

  return (
    <div className="screen">
      <section className="card mic-card" aria-live="polite">
        <div className="listen-bar">{n.listening && <span key={n.line?.text} className="shrink" />}</div>
        <div className="mic-row">
          <div className={`mic-orb ${micCls}`}>{n.mic === 'error' ? <MicOffIcon size={28} /> : <MicIcon size={28} />}</div>
          <div className="mic-text">
            <div className="mic-state">{n.mic === 'listening' && !quiet && <span className="dot live" />}{micLabel}</div>
            <div className="mic-sub">{micSub}<span className={`wave ${n.mic === 'listening' && !quiet ? 'on' : ''}`}><i /><i /><i /><i /></span></div>
          </div>
          <button className="ruko" onClick={n.ruko} aria-label="Ruko: stop Nirhast speaking"><StopIcon size={20} />RUKO</button>
        </div>
        {(quiet || state.ordersPaused) && (
          <div className="chips" style={{ padding: '0 16px 14px' }}>
            {quiet && <span className="tag wait">Quiet: {quietMin} min • only late alerts</span>}
            {state.ordersPaused && <span className="tag red">Naye order band</span>}
          </div>
        )}
      </section>

      {!n.started && (
        <div className="info-box">
          <strong><InfoIcon size={18} />Kitchen abhi band hai</strong>
          <p>Start the kitchen once so Nirhast can listen and speak. <button className="btn-outline" style={{ marginTop: 10 }} onClick={goStart}>Go to Start</button></p>
        </div>
      )}
      {n.error && <div className="banner-error" role="alert">{n.error}</div>}

      <section className={`card hero ${kind === 'saved' ? 'saved' : ''} ${kind === 'alert' ? 'alert' : ''}`} aria-live="polite">
        <div className="hero-top">
          <span className={`tag ${status[0]}`}><span className="dot" />{status[1]}</span>
          {dialogOrder?.promised && <span className="due"><ClockIcon size={14} />Due {dialogOrder.promised.label}</span>}
        </div>
        {n.line?.text
          ? <p className="hero-line">“{n.line.text}”</p>
          : <p className="hero-line idle">Order aane par main bolungi.</p>}
        <div className="hearing">
          <EarIcon size={16} />
          <span>Suna:</span>
          {n.interim ? <em>{n.interim}…</em> : <b>{n.heard?.text ? `‘${n.heard.text}’` : '—'}</b>}
          {n.heard?.status === 'saved' && <span className="saved">→ Saved</span>}
          {n.heard?.status === 'ignored' && <span className="muted">→ koi sawaal nahi tha</span>}
        </div>
      </section>

      {dialog?.kind === 'phrase' && n.phrase && (
        <div className="phrase"><span className="label">Owner check • yeh boliye</span><strong>“{n.phrase}”</strong></div>
      )}

      {yesNo && (
        <div className="answers">
          <button className="answer yes" onClick={() => (dialogOrder ? n.press(dialogOrder.id, 'yes') : say('haan'))}><b>Haan</b><small>Confirm</small></button>
          <button className="answer" onClick={() => (dialogOrder ? n.press(dialogOrder.id, 'no') : say('nahi'))}><b>Nahi</b><small>Decline</small></button>
          {dialogOrder
            ? <button className="answer" onClick={() => say('baad mein')}><b>Baad mein</b><small>5 min</small></button>
            : <button className="answer" onClick={n.ruko}><b>Ruko</b><small>Stop</small></button>}
        </div>
      )}

      {pending.length > 0 && (
        <section className="card">
          <div className="card-head"><h2 className="card-title">Button se bataiye</h2><span className="count">{pending.length} pending</span></div>
          {pending.map((o) => (
            <div key={o.id} className="inner pending-card">
              <OrderLine state={state} order={o} />
              <div className="answers">
                <button className="answer yes" onClick={() => n.press(o.id, 'yes')}><b>Haan</b><small>Confirm</small></button>
                <button className="answer" onClick={() => n.press(o.id, 'no')}><b>Nahi</b><small>Decline</small></button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <span className="tag lav"><UtensilsIcon size={14} />Ab kya banaun?</span>
          {nextUp && <span className="count">{itemsLabel(state, nextUp.items)}</span>}
        </div>
        <button className="next-box" onClick={() => say('ab kya banaun?')} disabled={!n.started}>
          <div>
            <b>{nextUp ? `Pehle ${customerOf(state, nextUp.customerId)?.name} ji, ${nextUp.promised?.label}` : 'Abhi kuch confirm nahi hua'}</b>
            <span>Tap or say “Ab kya banaun?” to hear the cooking order</span>
          </div>
          <ArrowRightIcon />
        </button>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Today's Orders</h2>
          <span className="count">{activeCount} active • {doneCount} done</span>
        </div>
        {dialogOrder && <OrderRow state={state} order={dialogOrder} current />}
        {board.map((o) => <OrderRow key={o.id} state={state} order={o} />)}
        {!dialogOrder && board.length === 0 && (
          <p className="empty">{pending.length ? 'Upar wala order confirm hone ke baad yahan dikhega.' : 'Abhi koi order nahi. Chat tab se order bhejiye.'}</p>
        )}
      </section>

      <section className="card">
        <button className="sim-toggle" onClick={() => setSimOpen((v) => !v)} aria-expanded={simOpen}>
          <span className="card-title"><SlidersIcon />Type what the cook says <span className="tag demo">Demo</span></span>
          <span style={{ transform: simOpen ? 'none' : 'rotate(180deg)', display: 'inline-flex' }}><ChevronIcon /></span>
        </button>
        {simOpen && (
          <div className="sim-body">
            <form className="type-row" onSubmit={submit}>
              <label htmlFor="cook-input" className="sr-only">What the cook says</label>
              <input id="cook-input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="haan / 2 nahi, 3 / ab kya banaun?" disabled={!n.started} />
              <button className="btn-black" disabled={!n.started || !typed.trim()}>Bolo</button>
            </form>
            <div className="chips">
              {COOK_PHRASES.map((p, i) => (
                <button key={p} className={`chip ${i < 2 ? 'dark' : ''}`} disabled={!n.started} onClick={() => say(p)}>“{p}”</button>
              ))}
            </div>
            <p className="muted small">Speech in: {n.engine.note}</p>
          </div>
        )}
      </section>
    </div>
  );
}

function rank(o) { return { awaiting: 0, confirmed: 1, delivered: 2, declined: 3, cancelled: 3 }[o.status] ?? 4; }

const STATUS = {
  awaiting: ['wait', 'Waiting'], pending: ['wait', 'Button se'], confirmed: ['ok', 'Confirmed'],
  delivered: ['grey', 'Delivered'], declined: ['grey', 'Mana kiya'], cancelled: ['red', 'Cancelled'],
};

function OrderLine({ state, order }) {
  const c = customerOf(state, order.customerId);
  const meta = [order.promised?.label, ...(order.notes || []), order.changed ? 'badla gaya' : null].filter(Boolean).join(' • ');
  return (
    <div className="order-body">
      <div className="order-name">{c?.name} ji • {itemsLabel(state, order.items)}</div>
      <div className="order-meta">{meta}{order.address && <> • {order.address}</>}</div>
    </div>
  );
}

function OrderRow({ state, order, current }) {
  const [cls, label] = STATUS[order.status] || ['grey', order.status];
  return (
    <div className={`order ${order.status} ${current ? 'current' : ''}`}>
      <span className="dot" />
      <OrderLine state={state} order={order} />
      <span className={`tag ${cls}`}>{current ? 'Abhi pooch rahi' : label}</span>
    </div>
  );
}

// ---------------- 2. Customer chat (WhatsApp-style layout, simulated) ----------------
function ChatScreen({ n }) {
  const { state } = n;
  const [customerId, setCustomerId] = useState('c1');
  const [text, setText] = useState('');
  const endRef = useRef(null);
  const chat = state.chats[customerId] || [];
  const customer = customerOf(state, customerId);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [chat.length, customerId]);
  const send = (t) => { if (t.trim()) { n.sendCustomer(customerId, t); setText(''); } };

  return (
    <div className="screen chat-screen">
      <div className="wa">
        <div className="wa-demo">Demo: simulated WhatsApp chat</div>
        <div className="wa-head">
          <ArrowLeftIcon size={22} />
          <div className="wa-avatar" aria-hidden="true">{customer?.name[0]}</div>
          <div className="wa-who">
            <label htmlFor="who" className="sr-only">Choose customer</label>
            <select id="who" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              {state.customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ji{c.regular ? ' • Regular' : ''}{!c.address ? ' • No address' : ''}</option>
              ))}
            </select>
            <span>{customer?.phone}</span>
          </div>
          <div className="wa-head-icons"><MoreIcon size={22} /></div>
        </div>

        <div className="wa-thread">
          <span className="wa-day">Today</span>
          {chat.length === 0 && <p className="wa-hint">Customer ki taraf se likhiye: “Hi”, “2 thali 1 baje” ya “paneer hai aaj?”</p>}
          {chat.map((m, i) => {
            const out = m.from === 'customer';
            return (
              <div key={i} className={`wa-msg ${out ? 'out' : 'in'}`}>
                {!out && <span className="wa-sender">Nirhast kitchen</span>}
                {m.text}
                <span className="meta">{timeOf(m.at)}{out && <span className="ticks"><DoubleCheckIcon size={15} /></span>}</span>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <div className="wa-chips" aria-label="Quick customer messages (Demo)">
          {CUSTOMER_PHRASES.map((p) => <button key={p} className="wa-chip" onClick={() => send(p)}>{p}</button>)}
        </div>
        <form className="wa-compose" onSubmit={(e) => { e.preventDefault(); send(text); }}>
          <div className="wa-input">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message" aria-label="Customer message" />
          </div>
          <button className="wa-send" disabled={!text.trim()} aria-label="Send"><SendIcon size={22} /></button>
        </form>
      </div>
    </div>
  );
}

// ---------------- 3. Owner ----------------
function OwnerScreen({ n }) {
  const { state } = n;
  const today = state.todayDishes?.map((d) => d.toLowerCase());
  const onToday = (m) => !today || today.includes(m.name.toLowerCase());
  const active = state.orders.filter((o) => ACTIVE.includes(o.status)).length;
  const confirmed = state.orders.filter((o) => o.status === 'confirmed').length;
  const waiting = state.orders.filter((o) => ['awaiting', 'pending'].includes(o.status)).length;
  const openQs = state.ownerQueue.filter((q) => q.status === 'open').length;
  const orders = [...state.orders].sort((a, b) => rank(a) - rank(b) || minutesOf(a) - minutesOf(b));

  return (
    <div className="screen">
      <section className="card">
        <div className="card-head"><span className="label"><span className="dot live" style={{ display: 'inline-block', marginRight: 6 }} />Today at a glance</span></div>
        <div className="stats">
          <div className="stat"><b>{active}</b><span>Active orders</span></div>
          <div className="stat"><b>{confirmed}</b><span>Confirmed</span></div>
          <div className="stat hl"><b>{waiting}</b><span>Waiting for cook</span></div>
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2 className="card-title"><QuestionIcon />Question queue</h2><span className="tag lav">{openQs} open</span></div>
        <p className="card-sub">Questions only the owner can answer. Nirhast reads them to the cook at a calm moment.</p>
        {state.ownerQueue.length === 0 && <p className="empty">Koi sawaal nahi.</p>}
        {state.ownerQueue.map((q) => (
          <div key={q.id} className="row-item">
            <div><b>{customerOf(state, q.customerId)?.name} ji</b><div className="row-sub">“{q.text}”{q.answer ? ` → ${q.answer}` : ''}</div></div>
            <span className={`tag ${q.status === 'open' ? 'wait' : 'ok'}`}>{q.status === 'open' ? 'Open' : 'Answered'}</span>
          </div>
        ))}
      </section>

      <section className="card">
        <div className="card-head"><h2 className="card-title">Menu</h2><span className="tag lav">{state.menu.length} items</span></div>
        <p className="card-sub">Auto-replies to customers come only from this menu. Paneer is not on it today, so “paneer hai aaj?” goes to the question queue.</p>
        {state.menu.map((m) => (
          <div key={m.id} className={`row-item ${onToday(m) ? '' : 'off'}`}>
            <div><b>{m.name}</b><span className="price">₹{m.price}</span></div>
            <span className={`tag ${onToday(m) ? 'ok' : 'grey'}`}>{onToday(m) ? 'Aaj hai' : 'Aaj nahi'}</span>
          </div>
        ))}
      </section>

      <section className="card">
        <div className="card-head"><h2 className="card-title">All orders</h2><span className="count">{state.orders.length} today</span></div>
        {orders.length === 0 && <p className="empty">Abhi koi order nahi.</p>}
        {orders.map((o) => <OrderRow key={o.id} state={state} order={o} />)}
      </section>

      <section className="card">
        <div className="card-head"><h2 className="card-title"><ShieldIcon />Owner checks</h2><span className="tag lav">Protected</span></div>
        <p className="card-sub">Cancel, refund and price change need the owner to repeat a random phrase shown on screen. A helper hears “Yeh sirf owner kar sakti hain.”</p>
        <div className="row-item">
          <div><b>Speaking as <span className="tag demo">Demo</span></b><div className="row-sub">Stands in for recognising who is speaking</div></div>
          <label className="speaker">
            <span className="sr-only">Speaking as</span>
            <select value={state.speakingAs} onChange={(e) => n.setSpeaker(e.target.value)}>
              <option value="owner">Owner</option>
              <option value="helper">Helper</option>
              <option value="delivery">Delivery</option>
            </select>
          </label>
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2 className="card-title"><UsersIcon />Customers</h2><span className="count">{state.customers.filter((c) => c.regular).length} regulars</span></div>
        {state.customers.map((c) => (
          <div key={c.id} className="row-item">
            <div>
              <b>{c.name} ji</b>
              <div className="row-sub">{c.address || 'Address not saved'}{c.usual ? ` • usual ${itemsLabel(state, [c.usual])}` : ''}</div>
            </div>
            {c.regular ? <span className="tag lav">Regular</span> : !c.address ? <span className="tag wait">No address</span> : null}
          </div>
        ))}
      </section>

      <section className="card">
        <div className="card-head"><h2 className="card-title"><HistoryIcon />Action log</h2><span className="count">Who did what</span></div>
        {state.log.length === 0 && <p className="empty">Abhi kuch nahi hua.</p>}
        {state.log.slice(0, 15).map((l, i) => (
          <div key={i} className="log-item">
            <span className="log-icon"><HistoryIcon size={16} /></span>
            <p>{l.action}<span>{l.speaker}</span></p>
            <time>{timeOf(l.at)}</time>
          </div>
        ))}
      </section>

      <section className="card">
        <h2 className="card-title" style={{ marginBottom: 8 }}>Settings</h2>
        <p className="muted small" style={{ lineHeight: 1.5, marginBottom: 12 }}>
          Open {pad(state.hours.open)}–{pad(state.hours.close)}. <span className="tag demo">Demo</span> Data stays in this browser only; there is no sync.
        </p>
        <button className="btn-outline" onClick={() => { if (window.confirm('Reset all demo data?')) n.reset(); }}>Reset demo data</button>
      </section>
    </div>
  );
}

function pad(t) { return `${t.hour}:${String(t.minute).padStart(2, '0')}`; }
