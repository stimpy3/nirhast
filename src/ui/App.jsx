import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNirhast } from './useNirhast.js';
import { makeT } from './uiText.js';
import { LANGS, itemsText, timeLabel } from '../core/i18n.js';
import { savedToday } from '../core/metrics.js';
import AnalyticsScreen from './Analytics.jsx';
import Orb from './vendor/reactbits/Orb.jsx';
import {
  MicIcon, MicOffIcon, StopIcon, ClockIcon, HomeIcon, ChatIcon, StoreIcon, SlidersIcon, UtensilsIcon,
  ArrowRightIcon, SendIcon, DoubleCheckIcon, EarIcon, HistoryIcon, QuestionIcon, MoreIcon, ArrowLeftIcon, ChevronLeftIcon, CheckIcon,
  XIcon, PlusIcon, ChartIcon, PauseIcon, BoltIcon,
} from './icons.jsx';

// Demo tools (typing box, simulated customer chat, AI labels, "speaking as", log, reset) only show with ?demo=1.
// The cook's screens stay clean. How to run a demo: DEMO.md.
const DEMO = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo');
const COOK_PHRASES = ['haan', 'nahi', '2 nahi, 3', 'baad mein', 'ab kya banaun?', 'aaj kitne thali?', 'abhi mat bolo', 'galat, wapas', 'Sharma delivered'];
const CUSTOMER_PHRASES = ['Hi', '2 thali 1 baje', 'dal hai aaj?', 'paneer hai aaj?', 'usual 1 baje', '3 thali kar do'];
// Chat = the simulated customer WhatsApp. Always shown: it is how customers' messages reach the kitchen in this prototype.
// Chat stands in for WhatsApp until the real connection exists; then the app has 3 pages.
const TABS = [['kitchen', 'tabKitchen', HomeIcon], ['chat', 'tabChat', ChatIcon], ['analytics', 'tabAnalytics', ChartIcon], ['owner', 'tabOwner', SlidersIcon]];
const ACTIVE = ['awaiting', 'pending', 'confirmed'];

function timeOf(ms) {
  return new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}
const minutesOf = (o) => (o.promised ? o.promised.hour * 60 + (o.promised.minute || 0) : 9999);
const customerOf = (state, id) => state.customers.find((c) => c.id === id);
const hhmm = ({ hour, minute }) => `${String(hour).padStart(2, '0')}:${String(minute || 0).padStart(2, '0')}`;

export default function App() {
  const n = useNirhast();
  const lang = n.state.lang;
  const t = useMemo(() => makeT(lang), [lang]);
  const [tab, setTabRaw] = useState('kitchen');
  const prevTabs = useRef([]); // pages visited, for the back chevron
  const setTab = (next) => setTabRaw((cur) => { if (cur !== next) prevTabs.current = [...prevTabs.current, cur].slice(-10); return next; });
  const goBack = () => setTabRaw(() => prevTabs.current.pop() || 'kitchen');
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => { window.scrollTo(0, 0); }, [tab]);

  return (
    <div className="app">
      <header className="topbar">
        {tab !== 'kitchen'
          ? <button className="top-back" onClick={goBack} aria-label={t('back')}><ChevronLeftIcon size={22} /><span>{t(TABS.find(([id]) => id === tab)[1])}</span></button>
          : <div className="brand"><img className="logo-mark" src="./logo-lavender.png" alt="" width="26" height="26" /><span className="brand-name">Nirhast</span></div>}
        <button className={`avatar ${tab === 'owner' ? 'on' : ''}`} onClick={() => setTab('owner')} aria-label={t('tabOwner')}>
          <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="16" r="8.5" /><path d="M0 46c1-11 9-17 20-17s19 6 20 17z" /></svg>
        </button>
      </header>

      <main>
        {tab === 'kitchen' && <KitchenScreen n={n} t={t} goAnalytics={() => setTab('analytics')} />}
        {tab === 'analytics' && <AnalyticsScreen n={n} t={t} TodayCard={TodayCard} />}
        {tab === 'chat' && <ChatScreen n={n} t={t} />}
        {tab === 'owner' && <OwnerScreen n={n} t={t} />}
      </main>

      <nav className="tabbar" aria-label="Screens">
        {TABS.map(([id, label, Icon]) => (
          <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}>
            <Icon size={22} />{t(label)}
          </button>
        ))}
      </nav>
    </div>
  );
}

// Language picker: one card per language with a sample of its script, the name in that script, and in English.
// Selected = light lavender card, lavender script sample, filled check circle. Others = white card, empty circle.
const SCRIPT_SAMPLE = { en: 'Aa', hi: 'अआ', mr: 'ळ' };
function LanguagePicker({ n, t }) {
  return (
    <div className="lang-cards" role="radiogroup" aria-label={t('chooseLang')}>
      {LANGS.map((l) => {
        const on = n.state.lang === l.id;
        return (
          <button key={l.id} role="radio" aria-checked={on} className={`lang-card ${on ? 'on' : ''}`} onClick={() => n.setLang(l.id)}>
            <span className="lc-check" aria-hidden="true">{on && <CheckIcon size={13} />}</span>
            <span className="lc-sample" lang={l.id}>{SCRIPT_SAMPLE[l.id]}</span>
            <span className="lc-name" lang={l.id}>{l.native}</span>
            <span className="lc-sub">{l.id === 'en' ? ' ' : l.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// The React Bits orb (edited to stay light on white) behind the mic button, over a soft lavender glow:
// slow when idle, livelier while listening and speaking, faint when the mic is off.
const REDUCED_MOTION = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const ORB_LOOK = {
  idle: { speed: 0.5, opacity: 0.7, force: false },
  listening: { speed: 1, opacity: 0.85, force: true },
  speaking: { speed: 1.7, opacity: 1, force: true },
};
function OrbHalo({ size, mic, children }) {
  const look = ORB_LOOK[mic] || { speed: 0.25, opacity: 0.35, force: false };
  return (
    <div className={`orb-halo is-${mic}`} style={{ width: size, height: size }}>
      <span className="orb-glow" aria-hidden="true" />
      {!REDUCED_MOTION && (
        <Orb colors={['#B6AAF2', '#9C8FE8', '#D9D2FA']} backgroundColor="#FFFFFF" size={0.95} glow={2.2} speed={look.speed}
          opacity={look.opacity} forceHoverState={look.force} followCursor={false} rotateOnHover={false} clickPulse={false} />
      )}
      {children}
    </div>
  );
}

// Live dictation waveform: bars scroll from right to left and grow with the cook's voice (like voice dictation apps).
// While Nirhast speaks the bars move gently on their own; when the mic is off they lie flat.
function LiveWave({ levelRef, mode }) {
  const canvasRef = useRef(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const BAR = 3; const GAP = 3;
    let bars = [];
    let raf = 0; let last = 0; let t = 0;
    const draw = (now) => {
      raf = requestAnimationFrame(draw);
      if (now - last < 50) return; // ~20 new bars a second
      last = now; t += 1;
      const w = canvas.clientWidth; const h = canvas.clientHeight;
      if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
      const count = Math.floor(w / (BAR + GAP));
      const m = modeRef.current;
      const level = m === 'listening' ? (levelRef?.current || 0)
        : m === 'speaking' ? 0.25 + 0.2 * Math.abs(Math.sin(t / 3)) * Math.random() : 0;
      bars.push(level);
      if (bars.length > count) bars = bars.slice(-count);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = m === 'listening' || m === 'speaking' ? '#000' : '#C9C6D3';
      const offset = (w - count * (BAR + GAP) + GAP) / 2; // centre the row
      for (let i = 0; i < count; i++) {
        const v = i >= count - bars.length ? bars[i - (count - bars.length)] : 0; // newest bars on the right
        const bh = Math.max(3, Math.min(h, 3 + v * (h - 3)));
        const x = offset + i * (BAR + GAP);
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, (h - bh) / 2, BAR, bh, 1.5) : ctx.rect(x, (h - bh) / 2, BAR, bh);
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [levelRef]);
  return <canvas ref={canvasRef} className="live-wave" aria-hidden="true" />;
}

// ---------------- Kitchen ----------------
const MIC = {
  listening: ['micListening', 'subListening', ''],
  speaking: ['micSpeaking', 'subSpeaking', 'speaking'],
  paused: ['micPaused', 'subPaused', 'off'],
  typed: ['micTyped', 'subTyped', 'off'],
  error: ['micError', 'subError', 'error'],
  off: ['micOff', 'subOff', 'off'],
};

function KitchenScreen({ n, t, goAnalytics }) {
  const { state } = n;
  const lang = state.lang;
  const [typed, setTyped] = useState('');

  if (!n.started) {
    return (
      <div className="screen">
        {(
          <section className="k-plain">
            <h2 className="card-title" style={{ marginBottom: 12 }}>{t('chooseLang')}</h2>
            <LanguagePicker n={n} t={t} />
          </section>
        )}
        <section className="start-hero k-open">
          <OrbHalo size={230} mic="idle"><button className="big-mic" onClick={n.start} aria-label={t('tapStart')}><MicIcon size={40} /></button></OrbHalo>
          <button className="cta-primary" onClick={n.start}><MicIcon size={20} />{t('tapStart')}</button>
          <p className="muted small">{t('startShort')}</p>
        </section>
        <TodayCard state={state} now={n.now} t={t} />
        <ForecastCard n={n} t={t} onMore={goAnalytics} />
        <NextCard state={state} t={t} onTap={n.start} />
      </div>
    );
  }

  const quiet = Boolean(state.quietUntil);
  const quietMin = quiet ? Math.max(0, Math.ceil((state.quietUntil - n.now) / 60000)) : 0;
  const [micKey, subKey, micCls] = MIC[n.mic] || MIC.off;
  const micLabel = quiet && n.mic !== 'error' ? t('quietMode') : t(micKey);
  const micSub = quiet && n.mic !== 'error' ? `${quietMin} ${t('min')}` : t(subKey);
  const dialog = state.dialog;
  const dialogOrder = dialog?.kind === 'confirm' ? state.orders.find((o) => o.id === dialog.orderId) : null;
  const pending = state.orders.filter((o) => o.status === 'pending');
  const board = state.orders
    .filter((o) => o.id !== dialogOrder?.id && o.status !== 'pending')
    .sort((a, b) => rank(a) - rank(b) || minutesOf(a) - minutesOf(b));
  const nextUp = state.orders.filter((o) => o.status === 'confirmed').sort((a, b) => minutesOf(a) - minutesOf(b))[0];
  const activeCount = state.orders.filter((o) => ACTIVE.includes(o.status)).length;
  const doneCount = state.orders.filter((o) => o.status === 'delivered').length;
  const tap = (words) => n.handleCookText(words, 'button');
  const submit = (e) => { e.preventDefault(); if (typed.trim()) { n.handleCookText(typed, 'typed'); setTyped(''); } };

  const kind = n.line?.kind;
  const status = dialogOrder ? ['wait', t('stWaitConfirm')]
    : kind === 'saved' ? ['ok', t('stSaved')]
      : kind === 'alert' ? ['red', t('stAlert')]
        : dialog ? ['wait', t('stWaitAnswer')] : null;
  const yesNo = dialog && dialog.kind !== 'phrase' && !(dialog.kind === 'ownerQ' && dialog.stage === 'answer');

  return (
    <div className="screen">
      <section className="mic-card k-open" aria-live="polite">
        <div className="listen-bar">{n.listening && <span key={n.line?.text} className="shrink" />}</div>
        <div className={`mic-row dictation ${n.mic}`}>
          <div className="mic-text">
            <div className="mic-state">{n.mic === 'listening' && !quiet && <span className="dot live" />}{micLabel}<span className="mic-sub-inline">{micSub}</span></div>
            <LiveWave levelRef={n.levelRef} mode={quiet ? 'off' : n.mic} />
            {(n.interim || n.heard?.text) && (
              <div className="hearing live-heard">
                <EarIcon size={16} />
                <span>{t('heard')}</span>
                {n.interim ? <em>{n.interim}…</em> : <b>‘{n.heard.text}’</b>}
                {DEMO && n.heard?.label && <span className="tag lav">AI: {n.heard.label.type.replace('_', ' ')}</span>}
                {n.heard?.status === 'saved' && <span className="saved">{t('toSaved')}</span>}
              </div>
            )}
          </div>
          {n.micOff
            ? <button className="round-btn" onClick={n.micListen} aria-label={t('listenAria')}><MicIcon size={22} /></button>
            : <button className="round-btn" onClick={n.micStop} aria-label={t('stopAria')}><PauseIcon size={22} /></button>}
        </div>
        {(quiet || state.ordersPaused) && (
          <div className="chips" style={{ padding: '0 16px 14px' }}>
            {quiet && <span className="tag wait">{t('quietTag', { m: quietMin })}</span>}
            {state.ordersPaused && <span className="tag red">{t('ordersStopped')}</span>}
          </div>
        )}
      </section>

      {n.error && <div className="banner-error" role="alert">{n.error}</div>}

      <TodayCard state={state} now={n.now} t={t} />
      <ForecastCard n={n} t={t} onMore={goAnalytics} />

      <section className={`card hero ${kind === 'saved' ? 'saved' : ''} ${kind === 'alert' ? 'alert' : ''}`} aria-live="polite">
        {(status || dialogOrder?.promised) && (
          <div className="hero-top">
            {status && <span className={`tag ${status[0]}`}><span className="dot" />{status[1]}</span>}
            {dialogOrder?.promised && <span className="due"><ClockIcon size={14} />{t('due')} {timeLabel(lang, dialogOrder.promised)}</span>}
          </div>
        )}
        {n.line?.text
          ? <p className="hero-line">“{n.line.text}”</p>
          : <p className="hero-line idle">{t('idleLine')}</p>}
      </section>

      {dialog?.kind === 'phrase' && n.phrase && (
        <div className="phrase"><span className="label">{t('ownerCheck')}</span><strong>“{n.phrase}”</strong></div>
      )}

      {yesNo && (
        <div className="answers">
          <button className="answer yes" onClick={() => (dialogOrder ? n.press(dialogOrder.id, 'yes') : tap('haan'))}><b>{t('yes')}</b></button>
          <button className="answer no" onClick={() => (dialogOrder ? n.press(dialogOrder.id, 'no') : tap('nahi'))}><b>{t('no')}</b></button>
          {dialogOrder
            ? <button className="answer later" onClick={() => tap('baad mein')}><b>{t('later')}</b><small>{t('fiveMin')}</small></button>
            : <button className="answer" onClick={n.ruko}><b>{t('stop')}</b></button>}
        </div>
      )}

      {pending.length > 0 && (
        <section className="card">
          <div className="card-head"><h2 className="card-title">{t('useButtons')}</h2><span className="count">{t('pendingN', { n: pending.length })}</span></div>
          {pending.map((o) => (
            <div key={o.id} className="inner pending-card">
              <OrderLine state={state} order={o} t={t} />
              <div className="answers">
                <button className="answer yes" onClick={() => n.press(o.id, 'yes')}><b>{t('yes')}</b></button>
                <button className="answer no" onClick={() => n.press(o.id, 'no')}><b>{t('no')}</b></button>
              </div>
            </div>
          ))}
        </section>
      )}

      <NextCard state={state} t={t} onTap={() => tap('ab kya banaun?')} />

      <section className="k-plain">
        <div className="card-head">
          <h2 className="card-title">{t('todaysOrders')}</h2>
          <span className="count">{t('activeDone', { a: activeCount, d: doneCount })}</span>
        </div>
        {dialogOrder && <OrderRow state={state} order={dialogOrder} t={t} current />}
        {board.map((o) => <OrderRow key={o.id} state={state} order={o} t={t} />)}
        {!dialogOrder && board.length === 0 && <p className="empty">{pending.length ? t('emptyPending') : t('noOrders')}</p>}
      </section>

      <section className="k-plain">
        <h2 className="card-title" style={{ marginBottom: 12 }}>{t('language')}</h2>
        <LanguagePicker n={n} t={t} />
      </section>

      {DEMO && (
        <section className="card">
          <h2 className="card-title" style={{ marginBottom: 10 }}><SlidersIcon />Demo: type what the cook says</h2>
          <form className="type-row" onSubmit={submit}>
            <label htmlFor="cook-input" className="sr-only">What the cook says</label>
            <input id="cook-input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="haan / 2 nahi, 3 / ab kya banaun?" />
            <button className="btn-black" disabled={!typed.trim()}>Say</button>
          </form>
          <div className="chips">
            {COOK_PHRASES.map((p, i) => (
              <button key={p} className={`chip ${i < 2 ? 'dark' : ''}`} onClick={() => tap(p)}>“{p}”</button>
            ))}
          </div>
          <p className="muted small">Speech in: {n.engine} • AI: {n.config.groq ? 'Groq' : 'word rules'} • Voice: {n.config.sarvam ? 'Sarvam' : 'browser'}{n.notice ? ` • ${n.notice}` : ''}</p>
        </section>
      )}
    </div>
  );
}

// "What should I cook next?" — always shown; before Start, tapping it starts the kitchen.
function NextCard({ state, t, onTap }) {
  const lang = state.lang;
  const nextUp = state.orders.filter((o) => o.status === 'confirmed').sort((a, b) => minutesOf(a) - minutesOf(b))[0];
  return (
    <button className="card next-box" onClick={onTap}>
      <div>
        <span className="tag lav"><UtensilsIcon size={14} />{t('whatNext')}</span>
        {nextUp ? (
          <>
            <b>{t('firstUp', { name: customerOf(state, nextUp.customerId)?.name, time: timeLabel(lang, nextUp.promised) })}</b>
            <span>{itemsText(state, nextUp.items, lang)}</span>
          </>
        ) : <b className="muted">{t('nothingConfirmedTap')}</b>}
      </div>
      <span className="cta-arrow" aria-hidden="true"><ArrowRightIcon size={24} /></span>
    </button>
  );
}

// Short forecast for today; the reasoning is on the Analytics page.
function ForecastCard({ n, t, onMore }) {
  if (!n.forecast) return null;
  return (
    <button className="forecast-card k-plain" onClick={onMore}>
      <span className="tag lav"><ChartIcon size={14} />{t('fcTitle')}</span>
      <b>{n.state.forecastLine || t('forecastNoneUi')}</b>
      {n.forecast.enough && <span className="muted small">{t('fcSoFar', { n: n.forecast.soFar })}</span>}
      <span className="cta-link">{t('fcDetails')} <ArrowRightIcon size={15} /></span>
    </button>
  );
}

// Today at a glance + what voice saved today. Minutes are an estimate (see core/metrics.js).
export function TodayCard({ state, now, t }) {
  const active = state.orders.filter((o) => ACTIVE.includes(o.status)).length;
  const confirmed = state.orders.filter((o) => o.status === 'confirmed').length;
  const waiting = state.orders.filter((o) => ['awaiting', 'pending'].includes(o.status)).length;
  const saved = savedToday(state, now);
  const focus = waiting > 0 ? 2 : confirmed > 0 ? 1 : 0; // the stage that matters right now
  const tiles = [
    { n: active, label: t('activeOrders'), tag: t('tagToday'), dot: '#B8B4C4' },
    { n: confirmed, label: t('confirmed'), tag: t('tagToCook'), dot: '#9C8FE8' },
    { n: waiting, label: t('waitingCook'), tag: t('tagNeedsYou'), dot: '#7058B8' },
  ];
  return (
    <section className="card pipeline">
      <div className="pl-head">
        <span className="pl-title">{t('pipeline')}</span>
      </div>
      <div className="pl-tiles">
        {tiles.map((x, i) => (
          <div key={i} className={`pl-tile ${i === focus && x.n > 0 ? 'on' : ''} ${i === 2 && x.n > 0 ? 'alert' : ''}`}>
            <b>{x.n}</b>
            <span className="pl-label">{x.label}</span>
          </div>
        ))}
      </div>
      <div className="pl-bar" aria-hidden="true">{tiles.map((_, i) => <span key={i} className={i === focus ? 'on' : ''} />)}</div>
      <div className="saved-strip v2">
        <span className="saved-bolt" aria-hidden="true"><BoltIcon size={16} /></span>
        <div className="saved-main"><b>{t('aboutMin', { m: saved.minutes })}</b><span>{t('savedToday')}</span></div>
        <div className="saved-chips">
          <span><ChatIcon size={14} /><b>{saved.answered}</b> {t('msgsAnswered')}</span>
          <span><MicIcon size={14} /><b>{saved.handsFree}</b> {t('doneByVoice')}</span>
        </div>
      </div>
    </section>
  );
}

function rank(o) { return { awaiting: 0, confirmed: 1, delivered: 2, declined: 3, cancelled: 3 }[o.status] ?? 4; }

const STATUS = {
  awaiting: ['wait', 'sWaiting'], pending: ['wait', 'sPending'], confirmed: ['ok', 'sConfirmed'],
  delivered: ['grey', 'sDelivered'], declined: ['grey', 'sDeclined'], cancelled: ['red', 'sCancelled'],
};

function OrderLine({ state, order, t }) {
  const c = customerOf(state, order.customerId);
  const meta = [timeLabel(state.lang, order.promised), ...(order.notes || []), order.changed ? t('changed') : null].filter(Boolean).join(' • ');
  return (
    <div className="order-body">
      <div className="order-name">{c?.name} ji • {itemsText(state, order.items, state.lang)}</div>
      <div className="order-meta">{meta}{order.address && <> • {order.address}</>}</div>
    </div>
  );
}

function OrderRow({ state, order, t, current }) {
  const [cls, key] = STATUS[order.status] || ['grey', order.status];
  return (
    <div className={`order ${order.status} ${current ? 'current' : ''}`}>
      <span className="dot" />
      <OrderLine state={state} order={order} t={t} />
      <span className={`tag ${cls}`}>{current ? t('asking') : t(key)}</span>
    </div>
  );
}

// ---------------- Customer chat (simulated WhatsApp) ----------------
function ChatScreen({ n, t }) {
  const { state } = n;
  const [customerId, setCustomerId] = useState('c1');
  const [text, setText] = useState('');
  const endRef = useRef(null);
  const chat = state.chats[customerId] || [];
  const customer = customerOf(state, customerId);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [chat.length, customerId]);
  const send = (msg, source) => { if (msg.trim()) { n.sendCustomer(customerId, msg, source); setText(''); } };

  return (
    <div className="screen chat-screen">
      <div className="wa">
        <div className="wa-head">
          <ArrowLeftIcon size={22} />
          <div className="wa-avatar" aria-hidden="true">{customer?.name[0]}</div>
          <div className="wa-who">
            <label htmlFor="who" className="sr-only">Customer</label>
            <select id="who" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              {state.customers.map((c) => <option key={c.id} value={c.id}>{c.name} ji{!c.address ? ' • no address' : ''}</option>)}
            </select>
            <span>{customer?.phone}</span>
          </div>
          <div className="wa-head-icons"><MoreIcon size={22} /></div>
        </div>
        <div className="wa-thread">
          <span className="wa-day">{t('today')}</span>
          {chat.map((m, i) => {
            const out = m.from === 'customer';
            return (
              <div key={i} className={`wa-msg ${out ? 'out' : 'in'}`}>
                {!out && <span className="wa-sender">{t('kitchenName')}</span>}
                {m.text}
                <span className="meta">{timeOf(m.at)}{out && <span className="ticks"><DoubleCheckIcon size={15} /></span>}</span>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
        <div className="wa-chips">
          {CUSTOMER_PHRASES.map((p) => <button key={p} className="wa-chip" onClick={() => send(p, 'chip')}>{p}</button>)}
        </div>
        <form className="wa-compose" onSubmit={(e) => { e.preventDefault(); send(text, 'typed'); }}>
          <div className="wa-input">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('message')} aria-label={t('message')} />
          </div>
          <button className="wa-send" disabled={!text.trim()} aria-label={t('send')}><SendIcon size={22} /></button>
        </form>
      </div>
    </div>
  );
}

// ---------------- Owner ----------------
const Q_KIND = { question: 'kQuestion', complaint: 'kComplaint', special_request: 'kSpecial', payment: 'kPayment', suggestion: 'kSuggestion' };

function OwnerScreen({ n, t }) {
  const { state } = n;
  const lang = state.lang;
  const openQs = state.ownerQueue.filter((q) => q.status === 'open');

  return (
    <div className="screen">

      <section className="card">
        <h2 className="card-title" style={{ marginBottom: 4 }}>{t('kitchenHours')}</h2>
        <p className="card-sub">{t('hoursHint')}</p>
        <div className="hours">
          <label>{t('openTime')}<input type="time" value={hhmm(state.hours.open)} onChange={(e) => n.setHour('open', e.target.value)} /></label>
          <label>{t('closeTime')}<input type="time" value={hhmm(state.hours.close)} onChange={(e) => n.setHour('close', e.target.value)} /></label>
        </div>
      </section>

      {state.ownerQueue.length > 0 && (
        <section className="card">
          <div className="card-head"><h2 className="card-title"><QuestionIcon />{t('qQueue')}</h2>{openQs.length > 0 && <span className="tag wait">{openQs.length} {t('open')}</span>}</div>
          {state.ownerQueue.map((q) => (
            <div key={q.id} className="row-item">
              <div>
                <b>{customerOf(state, q.customerId)?.name} ji</b> <span className={`tag ${q.kind === 'complaint' ? 'red' : 'lav'}`}>{t(Q_KIND[q.kind] || 'kQuestion')}</span>
                <div className="row-sub">“{q.cookText || q.text}”{q.answer ? ` → ${q.answer}` : ''}</div>
              </div>
              <span className={`tag ${q.status === 'open' ? 'wait' : 'ok'}`}>{q.status === 'open' ? t('qOpen') : t('qAnswered')}</span>
            </div>
          ))}
        </section>
      )}

      <section className="menu-plain no-qty">
        <h2 className="mp-title">{t('todaysMenu')}</h2>
        <p className="mp-hint">{t('menuRowsHint')}</p>
        <div className="menu-rows" role="table" aria-label={t('todaysMenu')}>
          <div className="menu-row head" role="row">
            <span role="columnheader">{t('colItem')}</span>
            <span role="columnheader">{t('colPrice')}</span>
            <span aria-hidden="true" />
          </div>
          {state.menu.map((m) => {
            const off = m.today === false;
            return (
              <div key={m.id} className={`menu-row ${off ? 'off' : ''}`} role="row">
                <input aria-label={t('colItem')} value={m.name} placeholder={t('newItem')} onChange={(e) => n.editDish(m.id, { name: e.target.value })} />
                <label className="mp-price"><span aria-hidden="true">₹</span><input aria-label={t('colPrice')} type="number" inputMode="numeric" min="0" value={m.price}
                  onChange={(e) => n.editDish(m.id, { price: Math.max(0, parseInt(e.target.value || '0', 10)) })} /></label>
                <button className="row-del" onClick={() => n.removeDish(m.id)} aria-label={`${t('removeItem')} ${m.name}`}><XIcon size={18} /></button>
              </div>
            );
          })}
        </div>
        <button className="mp-add" onClick={n.addDish}><PlusIcon size={18} />{t('addItem')}</button>
      </section>



      {DEMO && (
        <section className="card">
          <h2 className="card-title" style={{ marginBottom: 10 }}><HistoryIcon />Demo tools</h2>
          <div className="row-item">
            <div><b>Speaking as</b><div className="row-sub">Stands in for recognising who is speaking</div></div>
            <label className="speaker">
              <span className="sr-only">Speaking as</span>
              <select value={state.speakingAs} onChange={(e) => n.setSpeaker(e.target.value)}>
                <option value="owner">Owner</option>
                <option value="helper">Helper</option>
                <option value="delivery">Delivery</option>
              </select>
            </label>
          </div>
          {state.log.slice(0, 10).map((l, i) => (
            <div key={i} className="log-item">
              <span className="log-icon"><HistoryIcon size={16} /></span>
              <p>{l.action}<span>{l.speaker}</span></p>
              <time>{timeOf(l.at)}</time>
            </div>
          ))}
          <button className="btn-outline" style={{ marginTop: 12 }} onClick={() => { if (window.confirm('Reset all demo data?')) n.reset(); }}>Reset demo data</button>
        </section>
      )}
    </div>
  );
}
