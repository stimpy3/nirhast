import React, { useEffect, useRef, useState } from 'react';
import { useNirhast } from './useNirhast.js';
import { itemsLabel } from '../core/customerBot.js';

const COOK_CHIPS = ['haan', 'nahi', '2 nahi, 3', 'baad mein', 'ab kya banaun?', 'aaj kitne thali?', 'abhi mat bolo', 'galat, wapas', 'Sharma delivered'];
const CUSTOMER_CHIPS = ['Hi', '2 thali 1 baje', 'paneer hai aaj?', 'usual 1 baje', '3 thali kar do', 'kab tak khula hai?'];

function timeOf(ms) {
  return new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export default function App() {
  const n = useNirhast();
  const [tab, setTab] = useState('kitchen');
  const [customerId, setCustomerId] = useState('c1');

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="logo" src="./logo.png" alt="" width="40" height="40" />
          <div>
            <h1>Nirhast</h1>
            <p>Hands-free kitchen assistant for WhatsApp orders</p>
          </div>
        </div>
        <div className="topbar-right">
          <span className="clock" title="Kitchen clock">{timeOf(n.now)}</span>
          <button className="ghost small" onClick={() => n.skipMinutes(5)} title="Move the demo clock forward to show timers">+5 min <span className="demo-tag">Demo</span></button>
        </div>
      </header>

      <nav className="tabs" aria-label="Screens">
        {[['kitchen', 'Kitchen'], ['customer', 'Customer chat'], ['owner', 'Owner']].map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>

      <main className="panes">
        <CustomerPane n={n} customerId={customerId} setCustomerId={setCustomerId} active={tab === 'customer'} />
        <KitchenPane n={n} active={tab === 'kitchen'} />
        <OwnerPane n={n} active={tab === 'owner'} />
      </main>
    </div>
  );
}

// ---------------- Kitchen ----------------
function MicPill({ mic, quiet }) {
  const map = {
    listening: ['Sun rahi hoon', 'mic-on'],
    speaking: ['Bol rahi hoon', 'mic-speaking'],
    paused: ['Ruki hui', 'mic-off'],
    typed: ['Typing mode', 'mic-off'],
    error: ['Mic nahi chal raha', 'mic-error'],
    off: ['Band', 'mic-off'],
  };
  const [label, cls] = quiet ? ['Quiet', 'mic-quiet'] : (map[mic] || map.off);
  return <span className={`pill ${cls}`}><span className="dot" />{label}</span>;
}

function KitchenPane({ n, active }) {
  const { state } = n;
  const [typed, setTyped] = useState('');
  const quietLeft = state.quietUntil ? Math.max(0, state.quietUntil - n.now) : 0;
  const dialogOrder = state.dialog?.orderId ? state.orders.find((o) => o.id === state.dialog.orderId) : null;
  const pending = state.orders.filter((o) => o.status === 'pending');
  const board = [...state.orders]
    .filter((o) => ['awaiting', 'confirmed', 'delivered'].includes(o.status) && !(state.dialog?.kind === 'confirm' && state.dialog.orderId === o.id))
    .sort((a, b) => rank(a) - rank(b) || (a.promised?.hour * 60 + (a.promised?.minute || 0)) - (b.promised?.hour * 60 + (b.promised?.minute || 0)));
  function rank(o) { return { awaiting: 0, confirmed: 1, delivered: 2 }[o.status]; }
  const submit = (t) => { n.handleCookText(t, 'typed'); setTyped(''); };

  return (
    <section className={`pane kitchen ${active ? 'active' : ''}`} aria-label="Kitchen screen">
      <div className="pane-head">
        <h2>Kitchen</h2>
        <div className="status-row">
          <MicPill mic={n.mic} quiet={Boolean(state.quietUntil)} />
          {state.quietUntil && <span className="pill quiet-badge">Quiet for {Math.ceil(quietLeft / 60000)} min</span>}
          {state.ordersPaused && <span className="pill paused-badge">Naye order band</span>}
        </div>
      </div>

      {!n.started ? (
        <div className="start-card">
          <p className="start-title">Kitchen shuru karein</p>
          <p>Mic stays open. No button, no wake word. Nirhast asks one question at a time and waits 6 seconds for your reply.</p>
          <button className="primary big" onClick={n.start}>🎙️ Start kitchen</button>
          <p className="muted small">
            Speech: {n.config.checked ? (n.config.wispr ? 'Wispr Flow API (key set on server)' : 'browser speech recognition (no Wispr key set)') : 'checking…'}.
            Works best in Chrome. You can also type what the cook says.
          </p>
        </div>
      ) : (
        <>
          <div className={`line-card ${n.line?.kind || ''}`} aria-live="polite">
            <span className="line-label">{n.mic === 'speaking' ? 'Nirhast bol rahi hai' : 'Nirhast'}</span>
            <p className="line-text">{n.line?.text || 'Order aane par main bolungi.'}</p>
          </div>

          <div className="heard-row" aria-live="polite">
            <span className="muted">Suna:</span>
            {n.interim ? <em className="interim">{n.interim}…</em> : <strong>{n.heard?.text || '—'}</strong>}
            {n.heard?.status === 'saved' && <span className="chip ok">Saved</span>}
            {n.heard?.status === 'ignored' && <span className="chip muted-chip">Koi sawaal nahi tha, ignore kiya</span>}
          </div>

          {state.dialog?.kind === 'phrase' && n.phrase && (
            <div className="phrase-card">Owner check, yeh boliye: <strong>“{n.phrase}”</strong></div>
          )}
          {n.error && <div className="error-banner" role="alert">{n.error}</div>}

          <div className="speech-meta">
            <span className="muted small">Speech in: {n.engine.note}</span>
            <button className="stop-btn" onClick={n.ruko} aria-label="Ruko: stop speaking">✋ Ruko</button>
          </div>

          {dialogOrder && state.dialog?.kind === 'confirm' && (
            <OrderCard state={state} order={dialogOrder} highlight />
          )}

          {pending.length > 0 && (
            <div className="pending-block">
              <h3>Button se bataiye</h3>
              {pending.map((o) => (
                <div key={o.id} className="pending-card">
                  <OrderCard state={state} order={o} />
                  <div className="yn">
                    <button className="yes" onClick={() => n.press(o.id, 'yes')}>Haan</button>
                    <button className="no" onClick={() => n.press(o.id, 'no')}>Nahi</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="board">
            <h3>Aaj ke order</h3>
            {board.length === 0 && <p className="muted">Abhi koi order nahi. Customer chat se order bhejiye.</p>}
            {board.map((o) => <OrderCard key={o.id} state={state} order={o} compact />)}
          </div>
        </>
      )}

      <form className="typed-input" onSubmit={(e) => { e.preventDefault(); submit(typed); }}>
        <label htmlFor="cook-input" className="muted small">Type what the cook says <span className="demo-tag">Demo</span></label>
        <div className="row">
          <input id="cook-input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="haan / 2 nahi, 3 / ab kya banaun?" disabled={!n.started} />
          <button className="primary" disabled={!n.started || !typed.trim()}>Bolo</button>
        </div>
        <div className="chips">
          {COOK_CHIPS.map((c) => <button type="button" key={c} className="chip-btn" disabled={!n.started} onClick={() => submit(c)}>{c}</button>)}
        </div>
      </form>
    </section>
  );
}

function OrderCard({ state, order, highlight, compact }) {
  const c = state.customers.find((x) => x.id === order.customerId);
  const statusLabel = { awaiting: 'Confirm baaki', pending: 'Button se bataiye', confirmed: 'Confirmed', delivered: 'Delivered', declined: 'Mana kiya', cancelled: 'Cancelled' }[order.status];
  return (
    <div className={`order-card ${order.status} ${highlight ? 'highlight' : ''} ${compact ? 'compact' : ''}`}>
      <div className="order-main">
        <span className="order-name">{c?.name} ji</span>
        <span className="order-items">{itemsLabel(state, order.items)}</span>
        <span className="order-time">{order.promised?.label}</span>
      </div>
      <div className="order-sub">
        <span className={`status ${order.status}`}>{statusLabel}</span>
        {order.notes?.length > 0 && <span className="note">{order.notes.join(', ')}</span>}
        {!compact && order.address && <span className="muted small">{order.address}</span>}
        {order.changed && <span className="note">badla gaya</span>}
      </div>
    </div>
  );
}

// ---------------- Customer (simulated WhatsApp) ----------------
function CustomerPane({ n, customerId, setCustomerId, active }) {
  const { state } = n;
  const [text, setText] = useState('');
  const endRef = useRef(null);
  const chat = state.chats[customerId] || [];
  const customer = state.customers.find((c) => c.id === customerId);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [chat.length, customerId]);
  const send = (t) => { n.sendCustomer(customerId, t); setText(''); };

  return (
    <section className={`pane customer ${active ? 'active' : ''}`} aria-label="Customer chat (simulated WhatsApp)">
      <div className="pane-head">
        <h2>Customer chat</h2>
        <span className="demo-tag">Demo: simulated WhatsApp</span>
      </div>
      <div className="phone">
        <div className="wa-header">
          <div className="avatar">{customer?.name[0]}</div>
          <div className="wa-who">
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} aria-label="Choose customer">
              {state.customers.map((c) => <option key={c.id} value={c.id}>{c.name} ji{c.regular ? ' (regular)' : ''}{!c.address ? ' (no address)' : ''}</option>)}
            </select>
            <span className="muted small">{customer?.phone}</span>
          </div>
        </div>
        <div className="wa-body">
          {chat.length === 0 && <p className="wa-empty">Try “Hi”, “2 thali 1 baje” or “paneer hai aaj?”</p>}
          {chat.map((m, i) => (
            <div key={i} className={`bubble ${m.from === 'customer' ? 'out' : 'in'}`}>
              <span>{m.text}</span>
              <time>{timeOf(m.at)}</time>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <form className="wa-input" onSubmit={(e) => { e.preventDefault(); send(text); }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message" aria-label="Customer message" />
          <button className="send" disabled={!text.trim()} aria-label="Send">➤</button>
        </form>
      </div>
      <div className="chips">
        {CUSTOMER_CHIPS.map((c) => <button key={c} className="chip-btn" onClick={() => send(c)}>{c}</button>)}
      </div>
      <p className="muted small">Real WhatsApp (Business Cloud API) plugs in here as one module. Kitchen replies appear only after the order is saved.</p>
    </section>
  );
}

// ---------------- Owner ----------------
function OwnerPane({ n, active }) {
  const { state } = n;
  return (
    <section className={`pane owner ${active ? 'active' : ''}`} aria-label="Owner screen">
      <div className="pane-head">
        <h2>Owner</h2>
        <label className="speaker">
          Speaking as <span className="demo-tag">Demo</span>
          <select value={state.speakingAs} onChange={(e) => n.setSpeaker(e.target.value)}>
            <option value="owner">Owner</option>
            <option value="helper">Helper</option>
            <option value="delivery">Delivery person</option>
          </select>
        </label>
      </div>

      <div className="card">
        <h3>Menu</h3>
        {state.todayDishes && <p className="muted small">Aaj: {state.todayDishes.join(', ')}</p>}
        <ul className="menu-list">
          {state.menu.map((m) => <li key={m.id}><span>{m.name}</span><span>₹{m.price}</span></li>)}
        </ul>
        <p className="muted small">Paneer is not on today's menu, so “paneer hai aaj?” goes to the question queue.</p>
      </div>

      <div className="card">
        <h3>Question queue</h3>
        {state.ownerQueue.length === 0 && <p className="muted small">Koi sawaal nahi.</p>}
        {state.ownerQueue.map((q) => {
          const c = state.customers.find((x) => x.id === q.customerId);
          return <div key={q.id} className="q-row"><strong>{c?.name} ji:</strong> {q.text} <span className={`status ${q.status === 'open' ? 'awaiting' : 'confirmed'}`}>{q.status === 'open' ? 'open' : `answered: ${q.answer}`}</span></div>;
        })}
      </div>

      <div className="card">
        <h3>Customers</h3>
        <table className="table">
          <thead><tr><th>Name</th><th>Address</th><th>Usual</th></tr></thead>
          <tbody>
            {state.customers.map((c) => (
              <tr key={c.id}><td>{c.name}</td><td>{c.address || <em className="muted">not saved</em>}</td><td>{c.usual ? itemsLabel(state, [c.usual]) : '—'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Action log</h3>
        <ul className="log">
          {state.log.slice(0, 40).map((l, i) => <li key={i}><time>{timeOf(l.at)}</time> {l.action} <span className="muted">({l.speaker})</span></li>)}
        </ul>
      </div>

      <div className="card">
        <h3>Settings</h3>
        <p className="muted small">Hours: {state.hours.open.hour}:{String(state.hours.open.minute).padStart(2, '0')}–{state.hours.close.hour}:{String(state.hours.close.minute).padStart(2, '0')}. Data stays in this browser only.</p>
        <button className="ghost" onClick={() => { if (window.confirm('Reset all demo data?')) n.reset(); }}>Reset demo data</button>
      </div>
    </section>
  );
}
