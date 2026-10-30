/**
 * Profitlo — calculation engine
 * --------------------------------------------------------------
 * Pure functions only (no DOM access), so the exact same file runs
 * in the browser and inside the Node test suite (tests/run-tests.js).
 *
 * Every money value is in the user's chosen currency. All results are
 * ESTIMATES based on the user's own inputs — never guaranteed outcomes.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProfitloCalc = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- Field definitions ---------- */

  // Which input fields belong to which cost bucket.
  const GROUPS = {
    startup: ['equipment', 'registration', 'setup', 'marketing', 'otherStartup'],
    unit: ['rawMaterials', 'packaging', 'labor', 'delivery', 'otherUnit'],
    monthly: ['rent', 'salaries', 'utilities', 'subscriptions', 'otherMonthly'],
  };

  const PERCENT_FIELDS = ['feePercent', 'taxPercent', 'targetMargin'];
  const MONEY_FIELDS = [...GROUPS.startup, ...GROUPS.unit, ...GROUPS.monthly, 'price'];
  const COUNT_FIELDS = ['units', 'inventoryUnits'];
  const NUMERIC_FIELDS = [...MONEY_FIELDS, ...COUNT_FIELDS, ...PERCENT_FIELDS];

  const DEFAULT_TARGET_MARGIN = 20; // % used for the "suggested selling price"

  /* ---------- Safe number helpers ---------- */

  /**
   * Turn any user input into a safe, non-negative, finite number.
   * Empty strings, text, NaN, Infinity and negatives all become 0,
   * so a half-filled form can never break a calculation.
   */
  function num(value) {
    if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : 0;
    const n = parseFloat(String(value == null ? '' : value).replace(/,/g, '').trim());
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  /** Percentage input (e.g. "18") → fraction (0.18), clamped to 0–100 %. */
  function rate(value) {
    return Math.min(num(value), 100) / 100;
  }

  /** Divide safely: returns `fallback` instead of Infinity/NaN when b is 0. */
  function safeDiv(a, b, fallback = null) {
    return b !== 0 && Number.isFinite(a / b) ? a / b : fallback;
  }

  /** Build { field: number } for a group and return it with its total. */
  function breakdown(input, fields) {
    const items = {};
    let total = 0;
    fields.forEach((f) => {
      items[f] = num(input[f]);
      total += items[f];
    });
    return { items, total };
  }

  /* ---------- Main calculation ---------- */

  /**
   * Calculate every figure shown on the dashboard.
   * @param {object} input raw form values (strings or numbers)
   */
  function calculate(input) {
    const i = input || {};

    const price = num(i.price); // selling price per unit
    const units = num(i.units); // expected units sold per month

    // 1) Variable cost per unit = sum of per-unit product costs
    const unit = breakdown(i, GROUPS.unit);
    const variableCostPerUnit = unit.total;

    // Monthly fixed costs = rent + salaries + utilities + subscriptions + other
    const fixed = breakdown(i, GROUPS.monthly);
    const monthlyFixedCosts = fixed.total;

    // Platform/payment fees and tax are charged as a % of revenue.
    const feeRate = rate(i.feePercent);
    const taxRate = rate(i.taxPercent);
    const deductionRate = Math.min(feeRate + taxRate, 1);

    // 2) Revenue = selling price × units sold
    const revenue = price * units;

    // 3) Monthly total cost = fixed + (variable cost per unit × units) + fees + tax
    const variableCosts = variableCostPerUnit * units;
    const fees = revenue * feeRate;
    const tax = revenue * taxRate;
    const monthlyTotalCost = monthlyFixedCosts + variableCosts + fees + tax;

    // 4) Monthly profit or loss = revenue − monthly total cost
    const profit = revenue - monthlyTotalCost;

    // 5) Profit margin = profit ÷ revenue × 100 (only when revenue > 0)
    const margin = revenue > 0 ? (profit / revenue) * 100 : null;

    // 6) Startup investment = one-time startup costs + initial inventory cost
    const startup = breakdown(i, GROUPS.startup);
    const inventoryUnits = num(i.inventoryUnits);
    const initialInventoryCost = inventoryUnits * variableCostPerUnit;
    const startupInvestment = startup.total + initialInventoryCost;

    // 7) Break-even units = fixed costs ÷ (price − variable cost per unit), rounded up.
    //    Fees and tax are taken per unit too (price × fee/tax rate), so the
    //    "contribution" is what each sale really leaves to pay fixed costs.
    //    With 0 % fees/tax this is exactly fixed ÷ (price − variable cost).
    const deductionsPerUnit = price * deductionRate;
    const contributionPerUnit = price - variableCostPerUnit - deductionsPerUnit;
    let breakEvenUnits = null; // null = can never break even at this price
    if (contributionPerUnit > 0) {
      // small epsilon stops floating-point noise (e.g. 200.0000001) rounding up to 201
      breakEvenUnits = monthlyFixedCosts > 0 ? Math.ceil(monthlyFixedCosts / contributionPerUnit - 1e-9) : 0;
    }
    const breakEvenRevenue = breakEvenUnits === null ? null : breakEvenUnits * price;

    // Margin of safety: how far sales can fall before a loss (% of expected units)
    const safetyMargin =
      breakEvenUnits !== null && units > 0 ? ((units - breakEvenUnits) / units) * 100 : null;

    // Full cost per unit at the expected volume (fixed costs shared across units)
    const fullCostPerUnit = safeDiv(monthlyTotalCost, units);

    // Price needed just to cover all costs at the expected volume
    //   P × U × (1 − d) = F + V × U   →   P = (V + F/U) ÷ (1 − d)
    const breakEvenPrice =
      units > 0 && deductionRate < 1
        ? (variableCostPerUnit + monthlyFixedCosts / units) / (1 - deductionRate)
        : null;

    // Suggested selling price for a target profit margin m:
    //   P × U × (1 − d − m) = F + V × U   →   P = (V + F/U) ÷ (1 − d − m)
    const targetMargin =
      i.targetMargin === undefined || i.targetMargin === null || String(i.targetMargin).trim() === ''
        ? DEFAULT_TARGET_MARGIN
        : Math.min(num(i.targetMargin), 95);
    const priceDenominator = 1 - deductionRate - targetMargin / 100;
    const suggestedPrice =
      units > 0 && priceDenominator > 0
        ? (variableCostPerUnit + monthlyFixedCosts / units) / priceDenominator
        : null;

    // Units needed to hit the target margin at the CURRENT price:
    //   U × (P(1 − d − m) − V) = F
    const perUnitAtTarget = price * priceDenominator - variableCostPerUnit;
    const unitsForTarget = perUnitAtTarget > 0 ? Math.ceil(monthlyFixedCosts / perUnitAtTarget - 1e-9) : null;

    // Payback period: months of profit needed to recover the startup investment
    const paybackMonths = profit > 0 ? startupInvestment / profit : null;

    // Overall status (|profit| < 1 currency unit counts as break-even)
    let status = 'breakeven';
    if (revenue === 0 && monthlyTotalCost === 0) status = 'empty';
    else if (profit >= 1) status = 'profit';
    else if (profit <= -1) status = 'loss';

    // Warnings the UI turns into friendly messages
    const warnings = [];
    if (price === 0) warnings.push('NO_PRICE');
    if (units === 0) warnings.push('NO_UNITS');
    if (feeRate + taxRate >= 1) warnings.push('DEDUCTIONS_TOO_HIGH');
    if (price > 0 && price < variableCostPerUnit) warnings.push('PRICE_BELOW_UNIT_COST');
    else if (price > 0 && contributionPerUnit <= 0) warnings.push('NO_CONTRIBUTION');
    if (breakEvenUnits !== null && units > 0 && units < breakEvenUnits) warnings.push('BELOW_BREAK_EVEN');

    return {
      price,
      units,
      variableCostPerUnit,
      unitBreakdown: unit.items,
      monthlyFixedCosts,
      fixedBreakdown: fixed.items,
      feeRate,
      taxRate,
      deductionRate,
      revenue,
      variableCosts,
      fees,
      tax,
      monthlyTotalCost,
      profit,
      margin,
      oneTimeCosts: startup.total,
      startupBreakdown: startup.items,
      inventoryUnits,
      initialInventoryCost,
      startupInvestment,
      contributionPerUnit,
      deductionsPerUnit,
      breakEvenUnits,
      breakEvenRevenue,
      safetyMargin,
      fullCostPerUnit,
      breakEvenPrice,
      targetMargin,
      suggestedPrice,
      unitsForTarget,
      paybackMonths,
      status,
      warnings,
    };
  }

  /* ---------- Validation (for friendly form messages) ---------- */

  /**
   * Check raw form values. Returns { field: message } — empty object = valid.
   * The calculator itself never crashes on bad input; this is only for UX.
   */
  function validate(input) {
    const i = input || {};
    const errors = {};
    const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

    NUMERIC_FIELDS.forEach((f) => {
      const v = i[f];
      if (isBlank(v)) return;
      const n = Number(String(v).replace(/,/g, ''));
      if (!Number.isFinite(n)) errors[f] = 'Please enter a valid number.';
      else if (n < 0) errors[f] = 'This can’t be negative.';
      else if (PERCENT_FIELDS.includes(f) && n > 100) errors[f] = 'Enter a percentage between 0 and 100.';
      else if (n > 1e12) errors[f] = 'That number looks too large.';
    });

    if (!errors.price && num(i.price) === 0) errors.price = 'Enter a selling price greater than 0.';
    if (!errors.units && num(i.units) === 0) errors.units = 'Enter how many units you expect to sell each month.';
    if (!errors.feePercent && !errors.taxPercent && num(i.feePercent) + num(i.taxPercent) >= 100) {
      errors.taxPercent = 'Fees + tax must add up to less than 100%.';
    }
    if (!errors.targetMargin && !errors.feePercent && !errors.taxPercent && num(i.feePercent) + num(i.taxPercent) + num(i.targetMargin) >= 100) {
      errors.targetMargin = 'Fees + tax + target margin must stay below 100%.';
    }
    return errors;
  }

  /* ---------- Scenario helpers ---------- */

  /** Multiply every field in a group by a factor (e.g. all unit costs × 0.9). */
  function scaleGroup(input, group, factor) {
    const out = { ...input };
    GROUPS[group].forEach((f) => {
      out[f] = num(input[f]) * factor;
    });
    return out;
  }

  /**
   * Re-run the calculation with price / units / cost multipliers.
   * Factors are relative to the base: 1 = unchanged, 1.1 = +10 %.
   */
  function scenario(input, { priceFactor = 1, unitsFactor = 1, unitCostFactor = 1, fixedCostFactor = 1 } = {}) {
    let s = { ...input, price: num(input.price) * priceFactor, units: Math.round(num(input.units) * unitsFactor) };
    if (unitCostFactor !== 1) s = scaleGroup(s, 'unit', unitCostFactor);
    if (fixedCostFactor !== 1) s = scaleGroup(s, 'monthly', fixedCostFactor);
    return calculate(s);
  }

  /** Grid of monthly profits for price changes (rows) × sales changes (cols). */
  function sensitivityGrid(input, priceSteps, unitSteps) {
    return priceSteps.map((p) => unitSteps.map((u) => scenario(input, { priceFactor: 1 + p, unitsFactor: 1 + u }).profit));
  }

  /** Which 10 % change improves monthly profit the most? Sorted best → worst. */
  function levers(input, step = 0.1) {
    const base = calculate(input).profit;
    const list = [
      { key: 'price', label: `Raise price by ${step * 100}%`, r: scenario(input, { priceFactor: 1 + step }) },
      { key: 'units', label: `Sell ${step * 100}% more units`, r: scenario(input, { unitsFactor: 1 + step }) },
      { key: 'unitCost', label: `Cut per-unit costs by ${step * 100}%`, r: scenario(input, { unitCostFactor: 1 - step }) },
      { key: 'fixed', label: `Cut monthly fixed costs by ${step * 100}%`, r: scenario(input, { fixedCostFactor: 1 - step }) },
    ];
    return list
      .map((l) => ({ key: l.key, label: l.label, gain: l.r.profit - base, newProfit: l.r.profit }))
      .sort((a, b) => b.gain - a.gain);
  }

  /**
   * Cumulative cash position month by month: starts at −startup investment
   * and adds one month of profit (or loss) each month.
   */
  function projection(result, months = 12) {
    const points = [];
    for (let m = 0; m <= months; m++) points.push({ month: m, cash: -result.startupInvestment + result.profit * m });
    return points;
  }

  return {
    GROUPS,
    NUMERIC_FIELDS,
    PERCENT_FIELDS,
    DEFAULT_TARGET_MARGIN,
    num,
    calculate,
    validate,
    scenario,
    sensitivityGrid,
    levers,
    projection,
  };
});
