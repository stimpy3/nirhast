// Chart pieces for the Analytics page, one type per kind of number (plain SVG/HTML, no library).
// Every mark has a hover/tap title with its exact value; labels are written out so nothing depends on colour alone.
import React, { useEffect, useRef, useState } from 'react';

// Chart palette (Sohan, 28 Nov): Wisteria/lavender #7058B8 and Dry Sage #A2AD38. Taupe (brown) removed.
// Taupe = 'today' lines and labels; Wisteria = highlighted bars, ring, heatmap; Sage = the 'usual day' area.
// Soft colours on white, so every chart also writes its values out.
const PURPLE = '#7058B8'; // no taupe/brown in charts (Sohan, 28 Nov)
const WISTERIA = '#7058B8';
const INK = '#4B3F99';

// ---- Soft bars (reference style): rounded bars fading to white, value above, highlighted bar in purple ----
export function SoftBars({ items, height = 150, unit = '' }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="softbars" style={{ height: height + 52 }} role="img" aria-label={items.map((i) => `${i.label}: ${i.display ?? i.value}`).join(', ')}>
      {items.map((i, k) => (
        <div key={k} className={`sb-col ${i.highlight ? 'hl' : ''}`} title={`${i.label}: ${i.display ?? i.value} ${unit}`}>
          <span className="sb-val">{i.display ?? i.value}</span>
          <div className="sb-bar" style={{ height: Math.max(8, (i.value / max) * height) }} />
          <span className="sb-label">{i.label}</span>
        </div>
      ))}
    </div>
  );
}

const smooth = (pts) => pts.reduce((d, [x, y], i, a) => {
  if (i === 0) return `M${x},${y}`;
  const [px, py] = a[i - 1];
  const cx = (px + x) / 2;
  return `${d} C${cx},${py} ${cx},${y} ${x},${y}`;
}, '');

// ---- Area + line: "usual day" as a soft sage area, "today" as a lavender line, over the whole kitchen day.
// Wider than the screen: scroll sideways (swipe / drag / trackpad); round arrows on both sides show there is more.
// Hover (or tap) anywhere: a guide line and a box with the exact numbers for that half hour.
const SLOT_PX = 40;
export function AreaCompare({ points, labels = ['Today', 'Usual'], unit = '', focusIndex = 0 }) {
  const [hover, setHover] = useState(null);
  const [edge, setEdge] = useState({ left: false, right: false });
  const scroller = useRef(null);
  const W = Math.max(320, points.length * SLOT_PX); const H = 150; const top = 14; const bottom = 22; const pad = 14;
  const max = Math.max(1, ...points.flatMap((p) => [p.today, p.usual]));
  const x = (i) => pad + (W - 2 * pad) * (points.length === 1 ? 0.5 : i / (points.length - 1));
  const y = (v) => top + (H - top - bottom) * (1 - v / max);
  const usual = points.map((p, i) => [x(i), y(p.usual)]);
  const today = points.map((p, i) => [x(i), y(p.today)]);
  const base = y(0);

  const updateEdges = () => {
    const el = scroller.current;
    if (!el) return;
    setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  useEffect(() => { // open at the current time
    const el = scroller.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, (focusIndex / Math.max(1, points.length - 1)) * el.scrollWidth - el.clientWidth / 2);
    updateEdges();
  }, [points.length, focusIndex]);
  const nudge = (dir) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.7, behavior: 'smooth' });

  const pick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.touches ? e.touches[0].clientX : e.clientX) - r.left) / r.width * W;
    let best = 0;
    points.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
    setHover(best);
  };
  const h = hover !== null ? points[hover] : null;
  const boxW = 150;
  const bx = h ? Math.min(Math.max(x(hover) - boxW / 2, 2), W - boxW - 2) : 0;
  return (
    <div className="ac-wrap">
      <div className="ac-scroll" ref={scroller} onScroll={updateEdges}>
        <svg className="chart ac" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={points.map((p) => `${p.label}: ${p.today} / ${p.usual}`).join(', ')}
          onMouseMove={pick} onMouseLeave={() => setHover(null)} onTouchStart={pick}>
          <defs>
            <linearGradient id="ac-grey" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#A2AD38" stopOpacity="0.6" /><stop offset="1" stopColor="#A2AD38" stopOpacity="0.05" /></linearGradient>
          </defs>
          <path d={`${smooth(usual)} L${x(points.length - 1)},${base} L${x(0)},${base} Z`} fill="url(#ac-grey)" />
          <path d={smooth(usual)} fill="none" stroke="#76821F" strokeWidth="1.5" strokeDasharray="4 3" />
          <path d={smooth(today)} fill="none" stroke={WISTERIA} strokeWidth="2.5" strokeLinecap="round" />
          {points.map((p, i) => (
            <g key={i}>
              {p.today > 0 && <circle cx={x(i)} cy={y(p.today)} r="3.5" fill="#fff" stroke={WISTERIA} strokeWidth="2" />}
              {p.minute === 0 && <text x={x(i)} y={H - 6} className="axis" textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}>{p.label}</text>}
            </g>
          ))}
          {h && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={top} y2={base} stroke="#B5A6DD" strokeWidth="1" />
              <circle cx={x(hover)} cy={y(h.usual)} r="3.5" fill="#76821F" />
              <circle cx={x(hover)} cy={y(h.today)} r="4.5" fill={WISTERIA} stroke="#fff" strokeWidth="1.5" />
              <g transform={`translate(${bx}, 2)`}>
                <rect width={boxW} height="44" rx="8" fill="#2B2340" opacity="0.92" />
                <text x="8" y="14" className="tip">{h.label}</text>
                <text x="8" y="27" className="tip">{labels[0]}: {h.today} {unit}</text>
                <text x="8" y="39" className="tip dim">{labels[1]}: {h.usual} {unit}</text>
              </g>
            </g>
          )}
        </svg>
      </div>
      {edge.left && <button className="ac-arrow left" onClick={() => nudge(-1)} aria-label="Earlier"><ChevronLeft /></button>}
      {edge.right && <button className="ac-arrow right" onClick={() => nudge(1)} aria-label="Later"><ChevronRight /></button>}
    </div>
  );
}
const ChevronLeft = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>;
const ChevronRight = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>;

// ---- Calendar heatmap: one square per day, darker = busier ----
export function Heatmap({ days, weekdayNames, unit = '' }) {
  const max = Math.max(1, ...days.map((d) => d.value));
  // Weeks as rows, Monday first
  const order = [1, 2, 3, 4, 5, 6, 0];
  const firstCol = order.indexOf(days[0].weekday);
  const cells = [...Array(firstCol).fill(null), ...days];
  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return (
    <div className="heatmap" role="img" aria-label={days.map((d) => `${d.day}: ${d.value} ${unit}`).join(', ')}>
      <div className="hm-row hm-head">{order.map((w) => <span key={w}>{weekdayNames[w].slice(0, 2)}</span>)}</div>
      {rows.map((r, ri) => (
        <div key={ri} className="hm-row">
          {Array.from({ length: 7 }, (_, ci) => {
            const d = r[ci];
            if (!d) return <span key={ci} className="hm-cell empty" />;
            const k = d.value / max;
            return (
              <span key={ci} className={`hm-cell ${d.today ? 'today' : ''}`} title={`${d.title}: ${d.value} ${unit}`}
                style={{ background: `rgba(112, 88, 184, ${0.15 + k * 0.85})`, color: k > 0.6 ? '#fff' : '#4A3F55' }}>
                {d.value || ''}
              </span>
            );
          })}
        </div>
      ))}
      <div className="hm-legend"><span>0</span><i /><span>{max}</span></div>
    </div>
  );
}

// ---- Donut: each dish's share ----
const SHADES = ['#7058B8', '#A2AD38', '#AE9DDB', '#CCD47A', '#4B3F99', '#E3DCF5']; // lavender and sage
export function Donut({ slices, centerLabel }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const R = 52; const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="donut">
      <svg viewBox="0 0 140 140" role="img" aria-label={slices.map((s) => `${s.label}: ${s.value}`).join(', ')}>
        <g transform="rotate(-90 70 70)">
          {slices.map((s, i) => {
            const len = (s.value / total) * C;
            const seg = (
              <circle key={i} cx="70" cy="70" r={R} fill="none" stroke={SHADES[i % SHADES.length]} strokeWidth="20"
                strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-offset}>
                <title>{`${s.label}: ${s.value} (${Math.round((s.value / total) * 100)}%)`}</title>
              </circle>
            );
            offset += len;
            return seg;
          })}
        </g>
        <text x="70" y="68" textAnchor="middle" className="donut-total">{total}</text>
        <text x="70" y="86" textAnchor="middle" className="donut-sub">{centerLabel}</text>
      </svg>
      <ul className="donut-legend">
        {slices.map((s, i) => (
          <li key={i}><i style={{ background: SHADES[i % SHADES.length] }} /><span>{s.label}</span><b>{s.value}</b><small>{Math.round((s.value / total) * 100)}%</small></li>
        ))}
      </ul>
    </div>
  );
}

// ---- Ring gauge: one percentage ----
export function Gauge({ pct, label }) {
  const R = 46; const C = 2 * Math.PI * R;
  const v = pct ?? 0;
  return (
    <svg className="gauge" viewBox="0 0 120 120" role="img" aria-label={`${label}: ${pct ?? '—'}%`}>
      <circle cx="60" cy="60" r={R} fill="none" stroke="#D8DE95" strokeWidth="12" />
      <circle cx="60" cy="60" r={R} fill="none" stroke={WISTERIA} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${(v / 100) * C} ${C}`} transform="rotate(-90 60 60)" />
      <text x="60" y="68" textAnchor="middle" className="gauge-num">{pct ?? '—'}{pct !== null && pct !== undefined ? '%' : ''}</text>
    </svg>
  );
}

// ---- Small trend line with labelled points ----
export function Spark({ points, unit = '' }) {
  const W = 180; const H = 70; const pad = 14;
  const vals = points.map((p) => p.value ?? 0);
  const max = Math.max(1, ...vals); const min = Math.min(...vals);
  const x = (i) => pad + (W - 2 * pad) * (i / Math.max(1, points.length - 1));
  const y = (v) => 14 + (H - 34) * (1 - (v - min) / Math.max(1, max - min));
  const pts = points.map((p, i) => [x(i), y(p.value ?? 0)]);
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={points.map((p) => `${p.label}: ${p.value ?? '—'}${unit}`).join(', ')}>
      <path d={smooth(pts)} fill="none" stroke={INK} strokeWidth="2" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.value ?? 0)} r={i === points.length - 1 ? 4 : 3} fill={i === points.length - 1 ? PURPLE : '#fff'} stroke={PURPLE} strokeWidth="2" />
          <text x={x(i)} y={y(p.value ?? 0) - 8} className="axis" textAnchor="middle">{p.value ?? '—'}</text>
          <text x={x(i)} y={H - 4} className="axis" textAnchor="middle">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

// ---- Smooth line with a soft purple fill (a running quantity over days) ----
export function SmoothArea({ points, unit = '' }) {
  const W = 320; const H = 140; const top = 16; const bottom = 22; const pad = 10;
  const max = Math.max(1, ...points.map((p) => p.value));
  const x = (i) => pad + (W - 2 * pad) * (i / Math.max(1, points.length - 1));
  const y = (v) => top + (H - top - bottom) * (1 - v / max);
  const pts = points.map((p, i) => [x(i), y(p.value)]);
  const last = points.length - 1;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={points.map((p) => `${p.label}: ${p.value} ${unit}`).join(', ')}>
      <defs>
        <linearGradient id="sa-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={PURPLE} stopOpacity="0.28" /><stop offset="1" stopColor={PURPLE} stopOpacity="0" /></linearGradient>
      </defs>
      <path d={`${smooth(pts)} L${x(last)},${y(0)} L${x(0)},${y(0)} Z`} fill="url(#sa-fill)" />
      <path d={smooth(pts)} fill="none" stroke={PURPLE} strokeWidth="2.5" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={i}>
          <rect x={x(i) - 9} y={top} width="18" height={H - top - bottom} fill="transparent"><title>{`${p.label}: ${p.value} ${unit}`}</title></rect>
          {p.showLabel && <text x={Math.min(Math.max(x(i), 16), W - 16)} y={H - 6} className="axis" textAnchor="middle">{p.label}</text>}
        </g>
      ))}
      <circle cx={x(last)} cy={y(points[last].value)} r="5" fill={PURPLE} stroke="#fff" strokeWidth="2" />
      <g transform={`translate(${Math.min(x(last), W - 34)}, ${Math.max(y(points[last].value) - 26, 2)})`}>
        <rect x="-24" y="0" width="48" height="18" rx="6" fill="#1C1A24" />
        <text x="0" y="13" textAnchor="middle" className="tip">{points[last].value} {unit}</text>
      </g>
    </svg>
  );
}
