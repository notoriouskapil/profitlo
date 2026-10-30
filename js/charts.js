/**
 * Profitlo — tiny SVG chart library (no external dependencies, works offline).
 * Each function returns an HTML string. Colours come from CSS variables
 * (--s1…--s6, --good, --bad), so charts follow light/dark theme automatically.
 * Any element with a `data-tip` attribute gets a hover tooltip (see app.js).
 */
(function (root) {
  'use strict';

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  /** "Nice" axis ticks (1, 2, 2.5, 5 × 10ⁿ steps) covering [min, max]. */
  function niceTicks(min, max, count = 5) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
    if (min === max) max = min + 1;
    const raw = (max - min) / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const out = [];
    for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(10));
    return out;
  }

  /**
   * Bar path from baseline y0 to value y1 with the data end rounded (r px)
   * and the baseline end square.
   */
  function bar(x, y0, y1, w, r = 4) {
    const h = Math.abs(y1 - y0);
    if (h < 0.5) return '';
    r = Math.min(r, h, w / 2);
    if (y1 < y0) {
      // grows upward
      return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`;
    }
    return `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 - r}V${y0}Z`;
  }

  function legend(items) {
    return `<ul class="legend">${items
      .map(
        (it) =>
          `<li><span class="sw ${it.line ? 'sw-line' : ''}" style="--sw:${it.color}"></span>${esc(it.label)}${
            it.value ? ` <strong>${esc(it.value)}</strong>` : ''
          }</li>`
      )
      .join('')}</ul>`;
  }

  /* ------------------------------------------------------------------ */
  /* 1. Revenue vs cost (bar + stacked bar + profit bar)                  */
  /* ------------------------------------------------------------------ */
  function revenueVsCost(r, fmt, fmtC) {
    const W = 560, H = 300, L = 62, R = 16, T = 26, B = 40;
    const feesTax = r.fees + r.tax;
    const yMax = Math.max(r.revenue, r.monthlyTotalCost, 1);
    const yMin = Math.min(0, r.profit);
    const ticks = niceTicks(yMin, yMax, 5);
    const d0 = ticks[0], d1 = ticks[ticks.length - 1];
    const y = (v) => T + (H - T - B) * (1 - (v - d0) / (d1 - d0));
    const cols = 3, slot = (W - L - R) / cols, bw = Math.min(76, slot * 0.46);
    const cx = (i) => L + slot * i + (slot - bw) / 2;
    const zero = y(0);

    let g = '';
    ticks.forEach((t) => {
      g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/>`;
      g += `<text class="axis" x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${esc(fmtC(t))}</text>`;
    });

    // Revenue
    g += `<path d="${bar(cx(0), zero, y(r.revenue), bw)}" fill="var(--s1)" data-tip="Revenue|${esc(fmt(r.revenue))}"/>`;

    // Costs stacked: fixed → variable → fees & tax, with a 2px surface gap
    const parts = [
      { v: r.monthlyFixedCosts, c: 'var(--s2)', n: 'Fixed costs' },
      { v: r.variableCosts, c: 'var(--s3)', n: 'Variable costs' },
      { v: feesTax, c: 'var(--s4)', n: 'Fees & tax' },
    ].filter((p) => p.v > 0);
    let acc = 0;
    parts.forEach((p, idx) => {
      const top = idx === parts.length - 1;
      const yb = y(acc) - (idx ? 1 : 0);
      const yt = y(acc + p.v) + (top ? 0 : 1);
      if (yb - yt > 0.5) {
        g += top
          ? `<path d="${bar(cx(1), yb, yt, bw)}" fill="${p.c}" data-tip="${p.n}|${esc(fmt(p.v))}"/>`
          : `<rect x="${cx(1)}" y="${yt}" width="${bw}" height="${yb - yt}" fill="${p.c}" data-tip="${p.n}|${esc(fmt(p.v))}"/>`;
      }
      acc += p.v;
    });

    // Profit / loss
    const pos = r.profit >= 0;
    g += `<path d="${bar(cx(2), zero, y(r.profit), bw)}" fill="var(${pos ? '--good' : '--bad'})" data-tip="${
      pos ? 'Profit' : 'Loss'
    }|${esc(fmt(r.profit))}"/>`;

    // Value labels (text ink, never series colour)
    const lbl = (i, v, val) => {
      const ty = val >= 0 ? y(v) - 8 : y(v) + 16;
      return `<text class="val" x="${cx(i) + bw / 2}" y="${ty}" text-anchor="middle">${esc(fmtC(val))}</text>`;
    };
    g += lbl(0, r.revenue, r.revenue) + lbl(1, r.monthlyTotalCost, r.monthlyTotalCost) + lbl(2, r.profit, r.profit);

    g += `<line class="baseline" x1="${L}" x2="${W - R}" y1="${zero}" y2="${zero}"/>`;
    ['Revenue', 'Total costs', pos ? 'Profit' : 'Loss'].forEach((t, i) => {
      g += `<text class="axis cat" x="${cx(i) + bw / 2}" y="${H - 14}" text-anchor="middle">${t}</text>`;
    });

    const svg = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Monthly revenue ${esc(
      fmt(r.revenue)
    )} versus total costs ${esc(fmt(r.monthlyTotalCost))}, giving ${pos ? 'a profit' : 'a loss'} of ${esc(
      fmt(Math.abs(r.profit))
    )}">${g}</svg>`;

    return (
      svg +
      legend([
        { label: 'Revenue', color: 'var(--s1)' },
        { label: 'Fixed costs', color: 'var(--s2)' },
        { label: 'Variable costs', color: 'var(--s3)' },
        { label: 'Fees & tax', color: 'var(--s4)' },
        { label: pos ? 'Profit' : 'Loss', color: pos ? 'var(--good)' : 'var(--bad)' },
      ])
    );
  }

  /* ------------------------------------------------------------------ */
  /* 2. Break-even chart: revenue line vs total-cost line over units      */
  /* ------------------------------------------------------------------ */
  function breakEven(r, fmt, fmtC, fmtN) {
    const W = 560, H = 300, L = 62, R = 18, T = 22, B = 42;
    const be = r.breakEvenUnits;
    const xMax = Math.max(10, Math.ceil(Math.max(r.units * 1.5, be !== null ? be * 1.6 : 0)));
    const costSlope = r.variableCostPerUnit + r.price * r.deductionRate;
    const rev = (u) => r.price * u;
    const cost = (u) => r.monthlyFixedCosts + costSlope * u;
    const yMax = Math.max(rev(xMax), cost(xMax), 1);
    const yT = niceTicks(0, yMax, 5);
    const xT = niceTicks(0, xMax, 5).filter((t) => t <= xMax);
    const yTop = yT[yT.length - 1];
    const x = (u) => L + (W - L - R) * (u / xMax);
    const y = (v) => T + (H - T - B) * (1 - v / yTop);

    let g = '';
    yT.forEach((t) => {
      g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/>`;
      g += `<text class="axis" x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${esc(fmtC(t))}</text>`;
    });
    xT.forEach((t) => {
      g += `<text class="axis" x="${x(t)}" y="${H - B + 18}" text-anchor="middle">${esc(fmtN(t))}</text>`;
    });
    g += `<text class="axis" x="${(L + W - R) / 2}" y="${H - 4}" text-anchor="middle">Units sold per month</text>`;

    // Loss zone (cost above revenue) and profit zone shading
    if (be !== null && be <= xMax) {
      g += `<polygon class="zone-loss" points="${x(0)},${y(cost(0))} ${x(be)},${y(cost(be))} ${x(be)},${y(rev(be))} ${x(0)},${y(0)}"/>`;
      g += `<polygon class="zone-profit" points="${x(be)},${y(rev(be))} ${x(xMax)},${y(rev(xMax))} ${x(xMax)},${y(cost(xMax))} ${x(be)},${y(cost(be))}"/>`;
    } else {
      g += `<polygon class="zone-loss" points="${x(0)},${y(cost(0))} ${x(xMax)},${y(cost(xMax))} ${x(xMax)},${y(rev(xMax))} ${x(0)},${y(0)}"/>`;
    }

    g += `<line class="baseline" x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}"/>`;
    g += `<line class="series" stroke="var(--s2)" x1="${x(0)}" y1="${y(cost(0))}" x2="${x(xMax)}" y2="${y(cost(xMax))}"/>`;
    g += `<line class="series" stroke="var(--s1)" x1="${x(0)}" y1="${y(0)}" x2="${x(xMax)}" y2="${y(rev(xMax))}"/>`;

    // Expected sales marker
    if (r.units > 0) {
      g += `<line class="marker-line" x1="${x(r.units)}" x2="${x(r.units)}" y1="${T}" y2="${y(0)}"/>`;
      const anchor = x(r.units) > W - 120 ? 'end' : 'start';
      const dx = anchor === 'end' ? -6 : 6;
      g += `<text class="note" x="${x(r.units) + dx}" y="${T + 10}" text-anchor="${anchor}">Your plan: ${esc(fmtN(r.units))}</text>`;
    }
    // Break-even point
    if (be !== null && be <= xMax) {
      g += `<circle class="dot" cx="${x(be)}" cy="${y(rev(be))}" r="5"/>`;
      const anchor = x(be) < L + 110 ? 'start' : 'end';
      const dx = anchor === 'end' ? -10 : 10;
      g += `<text class="note strong" x="${x(be) + dx}" y="${y(rev(be)) - 10}" text-anchor="${anchor}">Break-even ≈ ${esc(
        fmtN(be)
      )} units</text>`;
    } else {
      g += `<text class="note strong" x="${W - R - 4}" y="${y(cost(xMax)) - 10}" text-anchor="end">Lines never meet — no break-even at this price</text>`;
    }

    // Invisible hover surface; app.js reads data-* to draw the crosshair tooltip
    g += `<g class="hover-layer"><line class="crosshair" x1="0" x2="0" y1="${T}" y2="${y(0)}" visibility="hidden"/></g>`;
    g += `<rect class="hover-rect" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"
      data-be='${JSON.stringify({ L, R, W, xMax, P: r.price, F: r.monthlyFixedCosts, S: costSlope })}'/>`;

    const svg = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${
      be !== null ? `Break-even at about ${esc(fmtN(be))} units per month` : 'Revenue never covers costs at this price'
    }; expected sales ${esc(fmtN(r.units))} units.">${g}</svg>`;

    return (
      svg +
      legend([
        { label: 'Revenue', color: 'var(--s1)', line: true },
        { label: 'Total cost', color: 'var(--s2)', line: true },
        { label: 'Profit zone', color: 'var(--good-soft)' },
        { label: 'Loss zone', color: 'var(--bad-soft)' },
      ])
    );
  }

  /* ------------------------------------------------------------------ */
  /* 3. Donut with legend (cost or investment breakdown)                  */
  /* ------------------------------------------------------------------ */
  function donut(segments, centerTop, centerValue, fmt) {
    const items = segments.filter((s) => s.value > 0);
    const total = items.reduce((a, s) => a + s.value, 0);
    const R = 74, SW = 24, C = 2 * Math.PI * R, size = 200, c = size / 2;
    let rings = `<circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke="var(--track)" stroke-width="${SW}"/>`;
    let offset = 0;
    const gap = items.length > 1 ? 2.5 : 0;
    items.forEach((s) => {
      const len = (s.value / total) * C;
      const dash = Math.max(len - gap, 0.5);
      rings += `<circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke="${s.color}" stroke-width="${SW}"
        stroke-dasharray="${dash} ${C - dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${c} ${c})"
        data-tip="${esc(s.label)}|${esc(fmt(s.value))} · ${((s.value / total) * 100).toFixed(1)}%"/>`;
      offset += len;
    });
    rings += `<text class="donut-top" x="${c}" y="${c - 6}" text-anchor="middle">${esc(centerTop)}</text>`;
    rings += `<text class="donut-val" x="${c}" y="${c + 18}" text-anchor="middle">${esc(centerValue)}</text>`;

    const list = items.length
      ? `<ul class="donut-legend">${items
          .map(
            (s) => `<li><span class="sw" style="--sw:${s.color}"></span><span class="dl-label">${esc(s.label)}</span>
              <span class="dl-val">${esc(fmt(s.value))}</span><span class="dl-pct">${((s.value / total) * 100).toFixed(0)}%</span></li>`
          )
          .join('')}</ul>`
      : '<p class="muted small">Nothing entered yet.</p>';

    return `<div class="donut-wrap"><svg viewBox="0 0 ${size} ${size}" class="donut" role="img" aria-label="${esc(
      centerTop
    )} ${esc(centerValue)}: ${items.map((s) => `${esc(s.label)} ${esc(fmt(s.value))}`).join(', ')}">${rings}</svg>${list}</div>`;
  }

  /* ------------------------------------------------------------------ */
  /* 4. 12-month cumulative cash position                                 */
  /* ------------------------------------------------------------------ */
  function cashflow(points, fmt, fmtC) {
    // narrower canvas on phones so bars and labels stay readable
    const W = typeof window !== 'undefined' && window.innerWidth < 700 ? 560 : 960, H = 280, L = 62, R = 14, T = 20, B = 36;
    const vals = points.map((p) => p.cash);
    const ticks = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals, 1), 5);
    const d0 = ticks[0], d1 = ticks[ticks.length - 1];
    const y = (v) => T + (H - T - B) * (1 - (v - d0) / (d1 - d0));
    const slot = (W - L - R) / points.length, bw = Math.max(6, Math.min(48, slot - 10));
    const zero = y(0);
    let g = '';
    ticks.forEach((t) => {
      g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/>`;
      g += `<text class="axis" x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${esc(fmtC(t))}</text>`;
    });
    points.forEach((p, i) => {
      const x = L + slot * i + (slot - bw) / 2;
      const pos = p.cash >= 0;
      g += `<path d="${bar(x, zero, y(p.cash), bw, 3)}" fill="var(${pos ? '--s1' : '--bad'})"
        data-tip="${p.month === 0 ? 'Day 1 (after investing)' : 'End of month ' + p.month}|${esc(fmt(p.cash))}"/>`;
      g += `<text class="axis" x="${x + bw / 2}" y="${H - B + 16}" text-anchor="middle">${p.month === 0 ? 'M0' : p.month}</text>`;
    });
    g += `<line class="baseline" x1="${L}" x2="${W - R}" y1="${zero}" y2="${zero}"/>`;
    g += `<text class="axis" x="${(L + W - R) / 2}" y="${H - 4}" text-anchor="middle">Month</text>`;
    const last = points[points.length - 1];
    return (
      `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Cash position after ${
        last.month
      } months: ${esc(fmt(last.cash))}">${g}</svg>` +
      legend([
        { label: 'Cash recovered (positive)', color: 'var(--s1)' },
        { label: 'Still in the red', color: 'var(--bad)' },
      ])
    );
  }

  /* ------------------------------------------------------------------ */
  /* 5. Health-score gauge (semi-circle)                                  */
  /* ------------------------------------------------------------------ */
  function gauge(score, toneVar) {
    const R = 80, cx = 100, cy = 100, len = Math.PI * R;
    const frac = Math.max(0, Math.min(1, score / 100));
    const path = `M${cx - R},${cy} A${R},${R} 0 0 1 ${cx + R},${cy}`;
    return `<svg viewBox="0 0 200 116" class="gauge" role="img" aria-label="Business health score ${score} out of 100">
      <path d="${path}" fill="none" stroke="var(--track)" stroke-width="16" stroke-linecap="round"/>
      <path d="${path}" fill="none" stroke="var(${toneVar})" stroke-width="16" stroke-linecap="round"
        stroke-dasharray="${len * frac} ${len}" class="gauge-arc"/>
      <text x="${cx}" y="${cy - 12}" text-anchor="middle" class="gauge-val">${score}</text>
      <text x="${cx}" y="${cy + 10}" text-anchor="middle" class="gauge-sub">out of 100</text>
    </svg>`;
  }

  root.ProfitloCharts = { revenueVsCost, breakEven, donut, cashflow, gauge, niceTicks, esc };
})(typeof self !== 'undefined' ? self : this);
