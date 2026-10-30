/**
 * Profitlo — AI Insights engine (rule-based expert system).
 * --------------------------------------------------------------
 * Runs entirely in the browser: no API keys, no data leaves the device.
 * It reads the calculator results, scores the plan's financial health
 * (0–100) and generates plain-English observations and recommendations,
 * the way a small-business advisor would reason through the numbers.
 */
(function (root, factory) {
  const api = factory(root.ProfitloCalc || (typeof require === 'function' ? require('./calculator.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProfitloInsights = api;
})(typeof self !== 'undefined' ? self : this, function (Calc) {
  'use strict';

  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  const LABELS = {
    rent: 'Rent',
    salaries: 'Salaries',
    utilities: 'Utilities',
    subscriptions: 'Subscriptions',
    otherMonthly: 'Other monthly costs',
    rawMaterials: 'Raw materials',
    packaging: 'Packaging',
    labor: 'Labour (per unit)',
    delivery: 'Delivery',
    otherUnit: 'Other per-unit costs',
  };

  /**
   * Health score out of 100, built from four weighted signals:
   *  - profit margin       (40 pts, full marks at ≥ 25 %)
   *  - margin of safety    (25 pts, full marks at ≥ 40 % above break-even)
   *  - payback period      (20 pts, full marks at ≤ 6 months, 0 at ≥ 36)
   *  - unit economics      (15 pts, full marks when each sale keeps ≥ 50 % of price)
   */
  function healthScore(r) {
    const margin = r.margin === null ? 0 : clamp01(r.margin / 25) * 40;
    const safety = r.safetyMargin === null ? 0 : clamp01(r.safetyMargin / 40) * 25;
    const payback = r.paybackMonths === null ? 0 : clamp01((36 - r.paybackMonths) / 30) * 20;
    const unitEcon = r.price > 0 ? clamp01(r.contributionPerUnit / r.price / 0.5) * 15 : 0;
    const score = Math.round(margin + safety + payback + unitEcon);
    let grade = 'High risk', tone = 'bad';
    if (score >= 75) (grade = 'Strong'), (tone = 'good');
    else if (score >= 50) (grade = 'Promising'), (tone = 'good');
    else if (score >= 30) (grade = 'Needs work'), (tone = 'warn');
    return { score, grade, tone, parts: { margin, safety, payback, unitEcon } };
  }

  /** Largest single monthly cost line (fixed item, per-unit item × units, fees or tax). */
  function biggestCost(r) {
    const lines = [];
    Object.entries(r.fixedBreakdown).forEach(([k, v]) => lines.push({ label: LABELS[k], value: v, kind: 'fixed' }));
    Object.entries(r.unitBreakdown).forEach(([k, v]) => lines.push({ label: LABELS[k], value: v * r.units, kind: 'unit' }));
    lines.push({ label: 'Platform & payment fees', value: r.fees, kind: 'fees' });
    lines.push({ label: 'Tax', value: r.tax, kind: 'tax' });
    lines.sort((a, b) => b.value - a.value);
    return lines[0] && lines[0].value > 0 ? lines[0] : null;
  }

  /**
   * Main entry point.
   * @param r       result of ProfitloCalc.calculate()
   * @param input   raw inputs (needed for lever simulations)
   * @param f       formatters { money, num, pct }
   */
  function analyse(r, input, f) {
    const items = [];
    const add = (tone, title, text) => items.push({ tone, title, text });
    const health = healthScore(r);

    // 1. Overall verdict
    if (r.status === 'profit') {
      add('good', 'Profitable on paper',
        `At ${f.num(r.units)} units a month you would keep about ${f.money(r.profit)} after every cost — a ${f.pct(r.margin)} profit margin.`);
    } else if (r.status === 'loss') {
      add('bad', 'Projected monthly loss',
        `Costs are higher than revenue by about ${f.money(-r.profit)} each month. The plan needs a higher price, lower costs or more sales before it pays for itself.`);
    } else if (r.status === 'breakeven') {
      add('warn', 'Right at break-even', 'Revenue just covers costs. Any dip in sales would turn this into a loss.');
    }

    // 2. Unit economics — does each sale make money?
    if (r.warnings.includes('PRICE_BELOW_UNIT_COST')) {
      add('bad', 'Price is below the cost to make one unit',
        `One unit costs ${f.money(r.variableCostPerUnit)} to make but sells for ${f.money(r.price)}, so every sale loses ${f.money(
          r.variableCostPerUnit - r.price
        )} before rent or salaries. Selling more will only grow the loss.`);
    } else if (r.warnings.includes('NO_CONTRIBUTION')) {
      add('bad', 'Fees and tax wipe out the margin',
        `After ${f.pct(r.deductionRate * 100)} in fees and tax, nothing is left from each sale to pay fixed costs.`);
    } else if (r.price > 0) {
      const ratio = (r.contributionPerUnit / r.price) * 100;
      add(ratio >= 30 ? 'good' : 'warn', ratio >= 30 ? 'Healthy unit economics' : 'Thin profit per unit',
        `Each sale leaves ${f.money(r.contributionPerUnit)} (${f.pct(ratio)} of the price) to cover fixed costs and profit.${
          ratio < 30 ? ' Small cost increases could erase it — try to build in more cushion.' : ''
        }`);
    }

    // 3. Break-even & margin of safety
    if (r.breakEvenUnits !== null && r.units > 0) {
      const s = r.safetyMargin;
      if (s >= 30) {
        add('good', 'Comfortable cushion above break-even',
          `You need ${f.num(r.breakEvenUnits)} units a month to break even. Sales could fall ${f.pct(s)} below your estimate before you make a loss.`);
      } else if (s >= 0) {
        add('warn', 'Small safety margin',
          `Break-even is ${f.num(r.breakEvenUnits)} units — only ${f.pct(s)} below your estimate of ${f.num(r.units)}. A slow month could mean a loss.`);
      } else {
        add('bad', 'Sales estimate is below break-even',
          `You need ${f.num(r.breakEvenUnits)} units a month but expect ${f.num(r.units)} — about ${f.num(
            r.breakEvenUnits - r.units
          )} more sales every month just to cover costs.`);
      }
    }

    // 4. Payback of the startup investment
    if (r.startupInvestment > 0) {
      if (r.paybackMonths !== null) {
        const m = r.paybackMonths;
        add(m <= 12 ? 'good' : m <= 24 ? 'warn' : 'bad', `Investment recovered in about ${Math.ceil(m)} months`,
          `Your ${f.money(r.startupInvestment)} startup investment would be paid back in roughly ${m.toFixed(1)} months of steady profit${
            m > 24 ? ' — a long time for a small business, so keep startup spending lean.' : '.'
          }`);
      } else {
        add('bad', 'Startup investment is not being recovered',
          `While the business runs at a loss, the ${f.money(r.startupInvestment)} you invest up front cannot be paid back.`);
      }
    }

    // 5. Biggest cost driver
    const big = biggestCost(r);
    if (big && r.monthlyTotalCost > 0) {
      const share = (big.value / r.monthlyTotalCost) * 100;
      add('tip', `Biggest cost: ${big.label}`,
        `${big.label} is about ${f.money(big.value)} a month (${f.pct(share)} of all costs). Bringing it down by 10% would add ${f.money(
          big.value * 0.1
        )} to monthly profit.`);
    }

    // 6. Pricing recommendation
    if (r.suggestedPrice !== null && r.price > 0) {
      const diff = ((r.suggestedPrice - r.price) / r.price) * 100;
      if (diff > 1) {
        add('tip', `Suggested price: ${f.money(r.suggestedPrice)}`,
          `To reach a ${f.pct(r.targetMargin)} margin at ${f.num(r.units)} units a month, price around ${f.money(r.suggestedPrice)} (${f.pct(
            diff
          )} higher).${r.unitsForTarget !== null ? ` Or keep today's price and sell about ${f.num(r.unitsForTarget)} units a month.` : ''} Check that customers will accept it.`);
      } else {
        add('good', 'Price meets your target margin',
          `Your price is at or above the ${f.money(r.suggestedPrice)} needed for a ${f.pct(r.targetMargin)} margin.`);
      }
    }

    // 7. Fees & tax drag
    if (r.deductionRate >= 0.15 && r.revenue > 0) {
      add('warn', `Fees and tax take ${f.pct(r.deductionRate * 100)} of every sale`,
        `That is ${f.money(r.fees + r.tax)} a month. Selling part of your volume directly (own website, WhatsApp or walk-in orders) avoids platform commission.`);
    }

    // 8. Best improvement lever (what-if simulation)
    const levers = Calc ? Calc.levers(input) : [];
    if (levers.length && levers[0].gain > 0) {
      add('tip', `Best lever: ${levers[0].label.toLowerCase()}`,
        `Of four common changes, this one improves monthly profit the most: about +${f.money(levers[0].gain)} a month.`);
    }

    // Capital plan: startup investment + 3 months of fixed costs as a safety reserve
    const reserve = r.monthlyFixedCosts * 3;
    const capital = { investment: r.startupInvestment, reserve, total: r.startupInvestment + reserve };

    const counts = items.reduce((a, it) => ((a[it.tone] = (a[it.tone] || 0) + 1), a), {});
    let headline;
    if (r.status === 'profit' && health.score >= 50)
      headline = 'This plan looks viable on paper. Keep an eye on the risks below before you invest.';
    else if (r.status === 'profit')
      headline = 'The plan makes a profit, but the cushion is thin. Strengthen it before committing money.';
    else headline = 'As entered, this plan loses money. The recommendations below show where to fix it first.';

    return { health, items, levers, capital, counts, headline };
  }

  return { analyse, healthScore };
});
