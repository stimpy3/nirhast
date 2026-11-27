// Analytics page: the forecast with its reasoning, and simple graphs of the kitchen's last weeks.
// Charts are plain SVG/HTML in the app's colours (validated: #4B3F99 "today/main", #9384E0 "usual day").
// Every bar has a hover/tap title with its exact value.
import React, { useMemo } from 'react';
import { buildAnalytics } from '../core/analytics.js';
import { WEEKDAYS, clockLabel, itemName } from '../core/i18n.js';
import { SoftBars, AreaCompare, Heatmap, Donut, Gauge } from './charts.jsx';

const C1 = 'var(--chart-1)';
const C2 = 'var(--chart-2)';

export default function AnalyticsScreen({ n, t, TodayCard }) {
  const { state, history, forecast } = n;
  const lang = state.lang;
  const a = useMemo(() => (history.loaded ? buildAnalytics(history, state, n.now) : null), [history, state, n.now]);
  if (!a) return <div className="screen"><p className="empty">…</p></div>;
  const wdName = WEEKDAYS[lang][a.weekday];
  const dish = (id) => (lang === 'en' ? state.menu.find((m) => m.id === id)?.name : itemName(state, id, lang)) || id;
  const cust = (id) => state.customers.find((c) => c.id === id)?.name || id;
  const shortDay = (d) => new Date(`${d}T12:00`).toLocaleDateString(lang === 'en' ? 'en-IN' : `${lang}-IN`, { day: 'numeric', month: 'short' });
  const thisWeek = a.weeks[3];

  return (
    <div className="screen">
      {TodayCard && <TodayCard state={state} now={n.now} t={t} />}
      <ForecastDetail f={forecast} t={t} lang={lang} wdName={wdName} dish={dish} shortDay={shortDay} />

      <section className="plain-sec">
        <h2 className="card-title chart-title">{t('chSlots')}</h2>
        <div className="legend"><span><i style={{ background: '#7058B8' }} />{t('lgToday')}</span><span><i className="dashed" />{t('lgTypical', { weekday: wdName })}</span></div>
        <AreaCompare
          points={a.slots.map((s) => ({ label: clockLabel(lang, s).replace(/^(सकाळी|दुपारी|संध्याकाळी|रात्री|सुबह|दोपहर|शाम|रात) /, ''), minute: s.minute, today: s.today, usual: s.typical }))}
          focusIndex={Math.max(0, a.slots.findIndex((s) => s.hour * 60 + s.minute >= new Date(n.now).getHours() * 60 + new Date(n.now).getMinutes()))}
          labels={[t('lgToday'), t('lgTypical', { weekday: wdName })]} unit="thali"
        />
      </section>

      <section className="plain-sec">
        <h2 className="card-title chart-title">{t('chDays')}</h2>
        <Heatmap days={a.perDay.map((d) => ({ day: d.day, weekday: d.weekday, value: d.thali, today: d.today, title: shortDay(d.day) }))} weekdayNames={WEEKDAYS[lang]} unit="thali" />
      </section>

      <section className="plain-sec">
        <h2 className="card-title chart-title">{t('chDishes')}</h2>
        <Donut slices={a.topDishes.map((d) => ({ label: dish(d.itemId), value: d.qty }))} centerLabel={t('itemsSold')} />
      </section>

      <section className="card sec-card">
        <h2 className="card-title chart-title">{t('chSat')}</h2>
        <div className="sat-row">
          <div className="gauge-wrap"><Gauge pct={thisWeek.happyPct} label={t('happyPct')} /><span>{t('happyPct')}</span></div>
          <div className="sat-side">
            <div className="sat-num"><b>{thisWeek.complaints}</b><span>{t('complaintsWeek')}</span></div>
            <div className="sat-num"><b>{thisWeek.per100}</b><span>{t('per100')}</span></div>
          </div>
        </div>
        {a.complaintTopics.length > 0 && (
          <>
            <p className="chart-sub" style={{ marginTop: 14 }}>{t('chTopics')}</p>
            <HBars rows={a.complaintTopics.map((x) => ({ label: t(`tp_${x.topic}`), value: x.n }))} />
          </>
        )}
        {a.quotes.length > 0 && (
          <>
            <p className="chart-sub" style={{ marginTop: 14 }}>{t('quotes')}</p>
            {a.quotes.map((q) => (
              <div key={q.id} className="quote-row">
                <span className={`tag ${q.sentiment === 'negative' ? 'red' : q.sentiment === 'positive' ? 'ok' : 'lav'}`}>{t(`fk_${q.kind}`)}</span>
                <span>“{q.text}” — {cust(q.customerId)} ji</span>
              </div>
            ))}
          </>
        )}
      </section>

    </div>
  );
}

function ForecastDetail({ f, t, lang, wdName, dish, shortDay }) {
  if (!f) return null;
  if (!f.enough) return <section className="plain-sec"><h2 className="card-title">{t('fcTitle')}</h2><p className="muted">{t('forecastNoneUi')}</p></section>;
  const weightedAvg = Math.round(f.mid / (1 + f.trendPct / 100));
  return (
    <section className="plain-sec forecast-detail">
      <div className="card fc-top">
      <h2 className="card-title">{t('fcTitle')}</h2>
      <p className="fc-big"><b>{f.low}–{f.high}</b> {t('fcThali')}</p>
      <p className="chart-sub">{t('fcWhy')}</p>
      <SoftBars items={[...f.sameDays].reverse().map((d) => ({ label: shortDay(d.day), value: d.thali }))
        .concat([{ label: t('lgToday'), value: f.mid, display: `${f.low}–${f.high}`, highlight: true }])} unit="thali" />
      </div>
      <dl className="fc-rows">
        <div><dt>{t('fcRowWeighted')}</dt><dd>{weightedAvg}</dd></div>
        <div><dt>{t('fcRowTrend')}</dt><dd>{f.trendPct > 0 ? '+' : ''}{f.trendPct}%</dd></div>
        <div className="fc-sum"><dt>{t('fcRowRange')}</dt><dd>{f.low}–{f.high}</dd></div>
      </dl>
      <p className="fc-label">{t('fcPrepTitle')}</p>
      <p className="fc-prep">
        {f.perDish.map((d) => <span key={d.itemId}><b>{d.qty}</b> {dish(d.itemId)}</span>)}
        {f.binaPyaaz > 0 && <span><b>{f.binaPyaaz}</b> bina pyaaz</span>}
      </p>
      <div className="fc-stats">
        <div><span>{t('fcBusiestLbl')}</span><b>{clockLabel(lang, f.busiest)}</b></div>
        <div><span>{t('fcSoFarLbl')}</span><b>{f.soFar}</b></div>
      </div>
    </section>
  );
}

// Vertical bars. groups: [{ label, values: [v1, v2?], title?, ghost? }]. One shared axis, recessive grid.
function Bars({ groups, colors, names, unit, max, thin }) {
  const W = 320; const H = 150; const top = 10; const bottom = 22; const left = 26;
  const peak = max || Math.max(1, ...groups.flatMap((g) => g.values));
  const step = peak > 10 ? 10 : 2; // round the top so the middle line is a whole number
  const nice = max || Math.ceil(peak / step) * step;
  const n = groups.length; const series = colors.length;
  const slot = (W - left) / n;
  const barW = Math.max(3, Math.min(thin ? 7 : 18, (slot - 4) / series - (series > 1 ? 2 : 0)));
  const y = (v) => top + (H - top - bottom) * (1 - v / nice);
  const ticks = [0, nice / 2, nice];
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={groups.map((g) => `${g.title || g.label}: ${g.values.join(' / ')}`).join(', ')}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={left} x2={W} y1={y(v)} y2={y(v)} className="grid" />
          <text x={left - 6} y={y(v) + 3} className="axis" textAnchor="end">{Math.round(v)}</text>
        </g>
      ))}
      {groups.map((g, i) => {
        const cx = left + slot * i + slot / 2;
        const totalW = series * barW + (series - 1) * 2;
        return (
          <g key={i}>
            {g.values.map((v, j) => {
              const x = cx - totalW / 2 + j * (barW + 2);
              const h = Math.max(v > 0 ? 2 : 0, y(0) - y(v));
              return (
                <rect key={j} x={x} y={y(0) - h} width={barW} height={h} rx={Math.min(4, barW / 2)}
                  fill={colors[j]} opacity={g.ghost ? 0.45 : 1} stroke={g.ghost ? colors[j] : 'none'} strokeDasharray={g.ghost ? '3 2' : undefined}>
                  <title>{`${g.title || g.label}${names[j] ? ` · ${names[j]}` : ''}: ${v} ${unit}`}</title>
                </rect>
              );
            })}
            {g.label && <text x={Math.min(cx, W - 2)} y={H - 6} className="axis" textAnchor={cx > W - 24 ? 'end' : 'middle'}>{g.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// Horizontal bars with the label and number written out (no colour needed to read them).
function HBars({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div key={r.label} className="hbar" title={`${r.label}: ${r.value}`}>
          <span className="hbar-label">{r.label}</span>
          <span className="hbar-track"><span style={{ width: `${(r.value / max) * 100}%` }} /></span>
          <span className="hbar-val">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
