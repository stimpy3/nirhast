// Analytics page: the forecast with its reasoning, and simple graphs of the kitchen's last weeks.
// Charts are plain SVG/HTML in the app's colours (validated: #4B3F99 "today/main", #9384E0 "usual day").
// Every bar has a hover/tap title with its exact value.
import React, { useMemo } from 'react';
import { buildAnalytics } from '../core/analytics.js';
import { WEEKDAYS, clockLabel, itemName } from '../core/i18n.js';

const C1 = 'var(--chart-1)';
const C2 = 'var(--chart-2)';

export default function AnalyticsScreen({ n, t }) {
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
      <ForecastDetail f={forecast} t={t} lang={lang} wdName={wdName} dish={dish} shortDay={shortDay} />

      <section className="card">
        <h2 className="card-title chart-title">{t('chSlots')}</h2>
        <div className="legend"><span><i style={{ background: C1 }} />{t('lgToday')}</span><span><i style={{ background: C2 }} />{t('lgTypical', { weekday: wdName })}</span></div>
        <Bars
          groups={a.slots.map((s) => ({ label: clockLabel(lang, s).replace(/^(सकाळी|दुपारी|संध्याकाळी|रात्री|सुबह|दोपहर|शाम|रात) /, ''), values: [s.today, s.typical] }))}
          colors={[C1, C2]} names={[t('lgToday'), t('lgTypical', { weekday: wdName })]} unit="thali"
        />
      </section>

      <section className="card">
        <h2 className="card-title chart-title">{t('chDays')}</h2>
        <Bars
          groups={a.perDay.map((d, i) => ({ label: i % 7 === 6 || d.today ? shortDay(d.day) : '', values: [d.thali], title: shortDay(d.day) }))}
          colors={[C1]} names={['']} unit="thali" thin
        />
      </section>

      <section className="card">
        <h2 className="card-title chart-title">{t('chDishes')}</h2>
        <HBars rows={a.topDishes.map((d) => ({ label: dish(d.itemId), value: d.qty }))} />
      </section>

      <section className="card">
        <h2 className="card-title chart-title">{t('chSat')}</h2>
        <div className="stats" style={{ marginBottom: 14 }}>
          <div className="stat"><b>{thisWeek.happyPct ?? '—'}{thisWeek.happyPct !== null ? '%' : ''}</b><span>{t('happyPct')}</span></div>
          <div className="stat"><b>{thisWeek.complaints}</b><span>{t('complaintsWeek')}</span></div>
          <div className="stat"><b>{thisWeek.per100}</b><span>{t('per100')}</span></div>
        </div>
        <p className="chart-sub">{t('happyByWeek')}</p>
        <Bars
          groups={a.weeks.map((w, i) => ({ label: i === 3 ? t('weekThis') : t('weekAgo', { n: 3 - i }), values: [w.happyPct ?? 0], title: `${w.happyPct ?? '—'}%` }))}
          colors={[C1]} names={['']} unit="%" max={100}
        />
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

      <section className="card">
        <h2 className="card-title chart-title">{t('chSaved')}</h2>
        <Bars
          groups={a.saved.map((d, i) => ({ label: i % 7 === 6 || d.today ? shortDay(d.day) : '', values: [d.minutes], title: shortDay(d.day) }))}
          colors={[C1]} names={['']} unit={t('min')}
        />
      </section>
    </div>
  );
}

function ForecastDetail({ f, t, lang, wdName, dish, shortDay }) {
  if (!f) return null;
  if (!f.enough) return <section className="card"><h2 className="card-title">{t('fcTitle')}</h2><p className="muted">{t('forecastNoneUi')}</p></section>;
  const weightedAvg = Math.round(f.mid / (1 + f.trendPct / 100));
  return (
    <section className="card forecast-detail">
      <h2 className="card-title">{t('fcTitle')}</h2>
      <p className="fc-big"><b>{f.low}–{f.high}</b> {t('fcThali')}</p>
      <p className="chart-sub">{t('fcWhy')}</p>
      <Bars
        groups={[...f.sameDays].reverse().map((d) => ({ label: shortDay(d.day), values: [d.thali] })).concat([{ label: t('lgToday'), values: [f.mid], title: `${f.low}–${f.high}`, ghost: true }])}
        colors={[C1]} names={['']} unit="thali"
      />
      <ol className="fc-steps">
        <li>{t('fcSameDays', { n: f.sameDays.length, weekday: wdName, list: [...f.sameDays].reverse().map((d) => d.thali).join(', ') })}</li>
        <li>{t('fcWeighted', { n: weightedAvg })}</li>
        <li>{f.trendPct === 0 ? t('fcFlat') : t(f.trendPct > 0 ? 'fcBusier' : 'fcQuieter', { p: Math.abs(f.trendPct), n: f.mid })}</li>
      </ol>
      <div className="chips">
        {f.perDish.map((d) => <span key={d.itemId} className="tag lav">{d.qty} {dish(d.itemId)}</span>)}
        {f.binaPyaaz > 0 && <span className="tag lav">{f.binaPyaaz} bina pyaaz</span>}
        <span className="tag wait">{t('fcBusiest', { t: clockLabel(lang, f.busiest) })}</span>
        <span className="tag ok">{t('fcSoFar', { n: f.soFar })}</span>
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
