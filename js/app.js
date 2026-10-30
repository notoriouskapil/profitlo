/**
 * Profitlo — app controller
 * Handles tabs/routing, the step-by-step form, validation messages,
 * rendering of every view, scenarios, theme and localStorage.
 * All maths lives in calculator.js; this file only displays results.
 */
(function () {
  'use strict';

  const Calc = window.ProfitloCalc;
  const Charts = window.ProfitloCharts;
  const AI = window.ProfitloInsights;
  const SAMPLES = window.ProfitloSamples;
  const esc = Charts.esc;

  const STORE_KEY = 'profitlo:v1';
  const VIEWS = ['home', 'planner', 'dashboard', 'scenarios', 'insights', 'method'];

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const icon = (name, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  /* ================================================================== */
  /* Configuration                                                       */
  /* ================================================================== */

  const CURRENCIES = [
    { code: 'INR', label: 'INR — Indian Rupee (₹)', locale: 'en-IN' },
    { code: 'USD', label: 'USD — US Dollar ($)', locale: 'en-US' },
    { code: 'EUR', label: 'EUR — Euro (€)', locale: 'en-IE' },
    { code: 'GBP', label: 'GBP — British Pound (£)', locale: 'en-GB' },
    { code: 'AED', label: 'AED — UAE Dirham', locale: 'en-AE' },
    { code: 'SGD', label: 'SGD — Singapore Dollar', locale: 'en-SG' },
    { code: 'AUD', label: 'AUD — Australian Dollar', locale: 'en-AU' },
    { code: 'CAD', label: 'CAD — Canadian Dollar', locale: 'en-CA' },
  ];

  // The four form sections. Fields are rendered from this config.
  const FORM = [
    {
      id: 'setup', title: 'Business Setup', short: 'Setup', sub: 'One-time costs', icon: 'building',
      tag: ['tag-once', 'one-time'],
      desc: 'Money you spend once to get started. Together with your first stock, this is your startup investment — not a monthly bill.',
      subtotal: ['Startup investment (incl. first stock)', (r) => money(r.startupInvestment)],
      groups: [
        { title: 'About your business', fields: [
          { id: 'businessName', label: 'Business name', type: 'text', placeholder: 'e.g. Aroma Candle Co.' },
          { id: 'productName', label: 'Product name', type: 'text', placeholder: 'e.g. Soy candle (200 g)' },
          { id: 'currency', label: 'Currency', type: 'currency', hint: 'All amounts use this currency. Default: Indian Rupee.' },
        ] },
        { title: 'One-time startup costs', fields: [
          { id: 'equipment', label: 'Equipment & tools', type: 'money', hint: 'Machines, moulds, kitchen gear, laptop.' },
          { id: 'registration', label: 'Registration & licences', type: 'money', hint: 'GST/Udyam registration, FSSAI, trade licence, legal fees.' },
          { id: 'setup', label: 'Shop / workspace setup', type: 'money', hint: 'Interiors, furniture, deposit, signage, website.' },
          { id: 'marketing', label: 'Launch marketing', type: 'money', hint: 'Opening offers, ads, flyers, social media promotion.' },
          { id: 'otherStartup', label: 'Other one-time costs', type: 'money', hint: 'Anything else you pay only once.' },
          { id: 'inventoryUnits', label: 'Initial inventory', type: 'count', suffix: 'units', hint: 'Units you make before the first sale. Costed at your per-unit cost.' },
        ] },
      ],
    },
    {
      id: 'product', title: 'Product Costs', short: 'Product', sub: 'Cost per unit', icon: 'box',
      tag: ['tag-unit', 'per unit'],
      desc: 'What it costs to make and deliver ONE unit. These costs grow with every unit you sell.',
      subtotal: ['Variable cost per unit', (r) => money(r.variableCostPerUnit)],
      groups: [
        { fields: [
          { id: 'rawMaterials', label: 'Raw materials', type: 'money', suffix: '/unit', hint: 'Ingredients or materials used in one unit.' },
          { id: 'packaging', label: 'Packaging', type: 'money', suffix: '/unit', hint: 'Box, jar, label, bag, tape.' },
          { id: 'labor', label: 'Labour per unit', type: 'money', suffix: '/unit', hint: 'Piece-rate wages. Put fixed monthly salaries in Monthly Expenses.' },
          { id: 'delivery', label: 'Delivery / shipping', type: 'money', suffix: '/unit', hint: 'Courier or delivery cost per order.' },
          { id: 'otherUnit', label: 'Other per-unit costs', type: 'money', suffix: '/unit', hint: 'Gift tags, samples, wastage allowance.' },
        ] },
      ],
    },
    {
      id: 'monthly', title: 'Monthly Expenses', short: 'Monthly', sub: 'Fixed costs', icon: 'calendar',
      tag: ['tag-month', 'monthly'],
      desc: 'Bills you pay every month, even in a month when you sell nothing.',
      subtotal: ['Total monthly fixed costs', (r) => money(r.monthlyFixedCosts)],
      groups: [
        { fields: [
          { id: 'rent', label: 'Rent', type: 'money', suffix: '/month', hint: 'Shop, kitchen, office or warehouse rent.' },
          { id: 'salaries', label: 'Salaries', type: 'money', suffix: '/month', hint: 'Fixed pay for staff (and yourself, if you draw a salary).' },
          { id: 'utilities', label: 'Utilities', type: 'money', suffix: '/month', hint: 'Electricity, water, gas, internet, phone.' },
          { id: 'subscriptions', label: 'Subscriptions', type: 'money', suffix: '/month', hint: 'Software, website hosting, POS, app plans.' },
          { id: 'otherMonthly', label: 'Other monthly costs', type: 'money', suffix: '/month', hint: 'Insurance, loan EMI, maintenance, accountant.' },
        ] },
      ],
    },
    {
      id: 'sales', title: 'Sales & Pricing', short: 'Sales', sub: 'Price & volume', icon: 'tag',
      tag: ['tag-month', 'monthly'],
      desc: 'What you charge and how many units you expect to sell each month. Start with a realistic, slightly cautious estimate.',
      subtotal: ['Expected monthly revenue', (r) => money(r.revenue)],
      groups: [
        { fields: [
          { id: 'price', label: 'Selling price per unit', type: 'money', suffix: '/unit', required: true, hint: 'What a customer pays for one unit.' },
          { id: 'units', label: 'Expected units sold', type: 'count', suffix: 'units/month', required: true, hint: 'Base it on market research, pre-orders or similar shops.' },
          { id: 'feePercent', label: 'Platform / payment fees', type: 'percent', hint: 'Commission + payment gateway, e.g. ~2% UPI/cards, 15–30% food apps.' },
          { id: 'taxPercent', label: 'Tax on sales', type: 'percent', hint: 'Share of each sale paid as tax (e.g. GST). 0 if not registered.' },
          { id: 'targetMargin', label: 'Target profit margin', type: 'percent', placeholder: '20', hint: 'Used to suggest a selling price. Leave blank for 20%.' },
        ] },
      ],
    },
  ];

  const ALL_FIELDS = FORM.flatMap((s) => s.groups.flatMap((g) => g.fields));
  const FIELD_SECTION = {};
  FORM.forEach((s, i) => s.groups.forEach((g) => g.fields.forEach((f) => (FIELD_SECTION[f.id] = i))));
  const DEFAULT_INPUTS = Object.fromEntries(ALL_FIELDS.map((f) => [f.id, '']));
  DEFAULT_INPUTS.currency = 'INR';

  /* ================================================================== */
  /* State + storage                                                     */
  /* ================================================================== */

  const state = {
    inputs: { ...DEFAULT_INPUTS },
    calculated: false,
    step: 0,
    saved: [],
    scen: null, // { price, units, unitCost, fixed, basePrice, baseUnits }
    insFilter: 'all',
    touched: new Set(),
    attempted: false,
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s && typeof s === 'object') {
        if (s.inputs) state.inputs = { ...DEFAULT_INPUTS, ...s.inputs };
        state.calculated = !!s.calculated;
        state.step = Math.min(Math.max(0, s.step | 0), FORM.length - 1);
        if (Array.isArray(s.saved)) state.saved = s.saved;
      }
    } catch (e) {
      /* storage blocked or corrupted — start fresh */
    }
  }

  let saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(
          STORE_KEY,
          JSON.stringify({ inputs: state.inputs, calculated: state.calculated, step: state.step, saved: state.saved })
        );
      } catch (e) {
        /* ignore (private mode etc.) */
      }
    }, 200);
  }

  /* ================================================================== */
  /* Formatting                                                          */
  /* ================================================================== */

  const fmtCache = new Map();
  function nf(locale, opts) {
    const key = locale + JSON.stringify(opts);
    if (!fmtCache.has(key)) fmtCache.set(key, new Intl.NumberFormat(locale, opts));
    return fmtCache.get(key);
  }
  const currency = (code = state.inputs.currency) => CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];

  /** Full money format. Shows paise/cents only for small non-whole amounts. */
  function money(v, code) {
    if (v === null || v === undefined || !Number.isFinite(v)) return '—';
    const c = currency(code);
    const d = Math.abs(v) < 1000 && Math.round(v * 100) % 100 !== 0 ? 2 : 0;
    return nf(c.locale, { style: 'currency', currency: c.code, minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
  }
  /** Compact money (₹1.2L, $12K) for chart axes. */
  function moneyC(v) {
    if (!Number.isFinite(v)) return '—';
    const c = currency();
    if (Math.abs(v) < 1000) return nf(c.locale, { style: 'currency', currency: c.code, maximumFractionDigits: 0 }).format(v);
    return nf(c.locale, { style: 'currency', currency: c.code, notation: 'compact', maximumFractionDigits: 1 }).format(v);
  }
  function numF(v) {
    if (v === null || !Number.isFinite(v)) return '—';
    return nf(currency().locale, { maximumFractionDigits: 0 }).format(v);
  }
  function pctF(v) {
    if (v === null || v === undefined || !Number.isFinite(v)) return '—';
    return nf('en-US', { maximumFractionDigits: 1 }).format(v) + '%';
  }
  function symbol() {
    const c = currency();
    const part = nf(c.locale, { style: 'currency', currency: c.code }).formatToParts(0).find((p) => p.type === 'currency');
    return part ? part.value : c.code;
  }
  const signed = (v, f = money) => (v > 0 ? '+' : v < 0 ? '−' : '') + f(Math.abs(v));

  /* ================================================================== */
  /* Small UI helpers                                                    */
  /* ================================================================== */

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  const tip = $('#tooltip');
  function showTip(x, y, html) {
    tip.innerHTML = html;
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let left = x + 14, top = y + 14;
    if (left + w > window.innerWidth - 8) left = x - w - 14;
    if (top + h > window.innerHeight - 8) top = y - h - 14;
    tip.style.left = Math.max(8, left) + 'px';
    tip.style.top = Math.max(8, top) + 'px';
  }
  function hideTip() {
    tip.hidden = true;
  }

  // Generic hover tooltip for chart marks with data-tip="Label|Value"
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (!el) {
      if (!e.target.closest || !e.target.closest('.hover-rect')) hideTip();
      return;
    }
    const [label, value] = el.getAttribute('data-tip').split('|');
    showTip(e.clientX, e.clientY, `${esc(label)}<b>${esc(value || '')}</b>`);
  });
  document.addEventListener('scroll', hideTip, { passive: true });

  /** Crosshair tooltip for the break-even line chart. */
  function bindBreakEvenHover(root) {
    $$('.hover-rect', root).forEach((rect) => {
      const p = JSON.parse(rect.getAttribute('data-be'));
      const svg = rect.ownerSVGElement;
      const ch = svg.querySelector('.crosshair');
      const plotW = p.W - p.L - p.R;
      rect.addEventListener('pointermove', (e) => {
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
        const u = Math.round(Math.max(0, Math.min(1, (loc.x - p.L) / plotW)) * p.xMax);
        const x = p.L + (plotW * u) / p.xMax;
        ch.setAttribute('x1', x);
        ch.setAttribute('x2', x);
        ch.setAttribute('visibility', 'visible');
        const rev = p.P * u, cost = p.F + p.S * u, prof = rev - cost;
        showTip(
          e.clientX,
          e.clientY,
          `<b>${numF(u)} units / month</b>
           <div class="tt-row"><span>Revenue</span><span>${money(rev)}</span></div>
           <div class="tt-row"><span>Total cost</span><span>${money(cost)}</span></div>
           <div class="tt-row"><span>${prof >= 0 ? 'Profit' : 'Loss'}</span><span>${money(prof)}</span></div>`
        );
      });
      rect.addEventListener('pointerleave', () => {
        ch.setAttribute('visibility', 'hidden');
        hideTip();
      });
    });
  }

  /* ================================================================== */
  /* Routing & tabs                                                      */
  /* ================================================================== */

  const tabs = $$('[role="tab"]');
  let focusPanelOnShow = false;

  function viewFromHash() {
    const v = location.hash.replace('#', '');
    return VIEWS.includes(v) ? v : 'home';
  }

  function navigate(view) {
    if (location.hash === '#' + view) showView(view);
    else location.hash = view; // triggers hashchange → showView
  }

  function showView(view) {
    tabs.forEach((t) => {
      const on = t.dataset.view === view;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    VIEWS.forEach((v) => ($('#view-' + v).hidden = v !== view));
    hideTip();
    renderView(view);
    window.scrollTo(0, 0);
    if (focusPanelOnShow) $('#view-' + view).focus({ preventScroll: true });
    focusPanelOnShow = false;
    const names = { home: 'Home', planner: 'Planner', dashboard: 'Dashboard', scenarios: 'Scenarios', insights: 'AI Insights', method: 'How it works' };
    document.title = `${names[view]} · Profitlo — Business Profit Planner`;
  }

  window.addEventListener('hashchange', () => {
    focusPanelOnShow = !document.activeElement || document.activeElement.getAttribute('role') !== 'tab';
    showView(viewFromHash());
  });

  tabs.forEach((t) => t.addEventListener('click', () => navigate(t.dataset.view)));

  // Arrow-key navigation inside the tablist (WAI-ARIA tabs pattern)
  $('#tablist').addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    let n = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % tabs.length;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') n = 0;
    if (e.key === 'End') n = tabs.length - 1;
    if (n === null) return;
    e.preventDefault();
    tabs[n].focus();
    navigate(tabs[n].dataset.view);
  });

  function renderView(view) {
    if (view === 'home') renderHome();
    if (view === 'planner') updateLive();
    if (view === 'dashboard') renderDashboard();
    if (view === 'scenarios') renderScenarios();
    if (view === 'insights') renderInsights();
    if (view === 'method') renderMethod();
  }

  /* ================================================================== */
  /* Theme                                                               */
  /* ================================================================== */

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = $('#themeToggle');
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }
  function initTheme() {
    let theme = null;
    try {
      theme = localStorage.getItem('profitlo:theme');
    } catch (e) {}
    if (theme !== 'light' && theme !== 'dark') {
      theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    applyTheme(theme);
  }
  $('#themeToggle').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
      localStorage.setItem('profitlo:theme', next);
    } catch (e) {}
  });

  /* ================================================================== */
  /* Planner form                                                        */
  /* ================================================================== */

  function fieldHTML(f) {
    const id = 'f-' + f.id;
    const described = [f.hint ? 'h-' + f.id : '', 'e-' + f.id].filter(Boolean).join(' ');
    const common = `id="${id}" name="${f.id}" aria-describedby="${described}"${f.required ? ' aria-required="true"' : ''}`;
    let control, pre = '', post = '';
    if (f.type === 'currency') {
      control = `<select ${common}>${CURRENCIES.map((c) => `<option value="${c.code}">${esc(c.label)}</option>`).join('')}</select>`;
    } else if (f.type === 'text') {
      control = `<input type="text" ${common} maxlength="60" placeholder="${esc(f.placeholder || '')}" />`;
    } else {
      const mode = f.type === 'count' ? 'numeric' : 'decimal';
      control = `<input type="text" inputmode="${mode}" ${common} placeholder="${esc(f.placeholder || '0')}" />`;
      if (f.type === 'money') pre = `<span class="adorn adorn-pre" data-cur aria-hidden="true">${esc(symbol())}</span>`;
      if (f.type === 'percent') post = `<span class="adorn adorn-post" aria-hidden="true">%</span>`;
      else if (f.suffix) post = `<span class="adorn adorn-post" aria-hidden="true">${esc(f.suffix)}</span>`;
    }
    return `<div class="field${f.type === 'currency' ? ' span-2' : ''}" data-field="${f.id}">
      <label for="${id}">${esc(f.label)}${f.required ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>
      <div class="input-wrap">${pre}${control}${post}</div>
      ${f.hint ? `<p class="hint" id="h-${f.id}">${esc(f.hint)}</p>` : ''}
      <p class="error-msg" id="e-${f.id}" hidden></p>
    </div>`;
  }

  function renderForm() {
    $('#stepper').innerHTML = FORM.map(
      (s, i) => `<li><button type="button" data-step="${i}" aria-label="Step ${i + 1}: ${esc(s.title)}">
        <span class="s-no">${i + 1}</span><span class="s-text"><span class="s-label">${esc(s.title)}</span><span class="s-sub">${esc(s.sub)}</span></span>
      </button></li>`
    ).join('');

    $('#formSections').innerHTML = FORM.map(
      (s, i) => `<fieldset class="form-section" data-section="${i}" hidden>
        <legend><div class="fs-head"><span class="fs-icon">${icon(s.icon)}</span><div>
          <span class="fs-title">${i + 1}. ${esc(s.title)} <span class="tag ${s.tag[0]}">${esc(s.tag[1])}</span></span>
          <p class="fs-desc">${esc(s.desc)}</p></div></div></legend>
        <div class="fields">${s.groups
          .map((g) => (g.title ? `<p class="field-group-title">${esc(g.title)}</p>` : '') + g.fields.map(fieldHTML).join(''))
          .join('')}</div>
        <div class="subtotal" aria-live="polite"><span>${esc(s.subtotal[0])}</span><span data-subtotal="${i}">—</span></div>
      </fieldset>`
    ).join('');

    const options = SAMPLES.map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join('');
    $('#sampleSelect').insertAdjacentHTML('beforeend', options);
  }

  function syncFormFromState() {
    ALL_FIELDS.forEach((f) => {
      const el = $('#f-' + f.id);
      if (el) el.value = state.inputs[f.id] ?? '';
    });
    $$('[data-cur]').forEach((el) => (el.textContent = symbol()));
    showFieldErrors();
  }

  function setStep(n) {
    state.step = Math.max(0, Math.min(FORM.length - 1, n));
    $$('.form-section').forEach((s, i) => (s.hidden = i !== state.step));
    $$('#stepper button').forEach((b, i) => {
      if (i === state.step) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
    $('#stepCount').textContent = `Step ${state.step + 1} of ${FORM.length}`;
    $('#prevStep').disabled = state.step === 0;
    const last = state.step === FORM.length - 1;
    $('#nextStep').innerHTML = last ? `${icon('chart')} Calculate results` : `Next ${icon('arrow')}`;
    save();
  }

  /** Show validation messages only for fields the user has touched (or after Calculate). */
  function showFieldErrors() {
    const errors = Calc.validate(state.inputs);
    const sectionErr = FORM.map(() => false);
    ALL_FIELDS.forEach((f) => {
      const wrap = $(`.field[data-field="${f.id}"]`);
      if (!wrap) return;
      const show = errors[f.id] && (state.attempted || state.touched.has(f.id));
      const msg = $('#e-' + f.id);
      const input = $('#f-' + f.id);
      wrap.classList.toggle('invalid', !!show);
      input.setAttribute('aria-invalid', show ? 'true' : 'false');
      msg.hidden = !show;
      msg.innerHTML = show ? `${icon('alert')}${esc(errors[f.id])}` : '';
      if (show) sectionErr[FIELD_SECTION[f.id]] = true;
    });
    // Stepper badges: started / has errors
    $$('#stepper button').forEach((b, i) => {
      const started = FORM[i].groups.some((g) => g.fields.some((f) => f.type !== 'currency' && String(state.inputs[f.id] || '').trim() !== ''));
      b.classList.toggle('is-done', started && !sectionErr[i]);
      b.classList.toggle('has-error', sectionErr[i]);
    });
    return errors;
  }

  /** Live estimate card in the planner sidebar. */
  function updateLive() {
    const r = Calc.calculate(state.inputs);
    const ready = r.price > 0 && r.units > 0;
    const p = $('#liveProfit');
    p.textContent = ready ? signed(r.profit) : '—';
    p.className = 'live-big' + (ready ? (r.profit >= 0 ? ' is-profit' : ' is-loss') : '');
    $('#liveInvest').textContent = money(r.startupInvestment);
    $('#liveUnit').textContent = money(r.variableCostPerUnit);
    $('#liveCost').textContent = money(r.monthlyTotalCost);
    $('#liveBE').textContent = r.price > 0 ? (r.breakEvenUnits === null ? 'Not reachable' : numF(r.breakEvenUnits) + ' units') : '—';
    $('#liveMargin').textContent = ready ? pctF(r.margin) : '—';
    const pill = $('#livePill');
    if (!ready) (pill.className = 'pill'), (pill.textContent = 'Add price & sales');
    else if (r.status === 'profit') (pill.className = 'pill pill-good'), (pill.innerHTML = `${icon('check')} Profit`);
    else if (r.status === 'loss') (pill.className = 'pill pill-bad'), (pill.innerHTML = `${icon('x')} Loss`);
    else (pill.className = 'pill pill-warn'), (pill.textContent = 'Break-even');

    const started = FORM.filter((s) => s.groups.some((g) => g.fields.some((f) => f.type !== 'currency' && f.type !== 'text' && String(state.inputs[f.id] || '').trim() !== ''))).length;
    $('#liveProgress').style.width = (started / FORM.length) * 100 + '%';
    $('#liveProgressText').textContent = `${started} of ${FORM.length} sections started`;
    FORM.forEach((s, i) => ($(`[data-subtotal="${i}"]`).textContent = s.subtotal[1](r)));
  }

  function onFieldInput(e) {
    const el = e.target;
    if (!el.name || !(el.name in DEFAULT_INPUTS)) return;
    state.inputs[el.name] = el.value;
    if (el.name === 'currency') {
      $$('[data-cur]').forEach((a) => (a.textContent = symbol()));
    }
    showFieldErrors();
    updateLive();
    if (!$('#formAlert').hidden && Object.keys(Calc.validate(state.inputs)).length === 0) $('#formAlert').hidden = true;
    save();
  }

  function calculateAndShow() {
    state.attempted = true;
    const errors = showFieldErrors();
    const keys = Object.keys(errors);
    const alertBox = $('#formAlert');
    if (keys.length) {
      const first = keys.sort((a, b) => FIELD_SECTION[a] - FIELD_SECTION[b])[0];
      alertBox.innerHTML = `${icon('alert')}<div><strong>Please check ${keys.length} field${keys.length > 1 ? 's' : ''} before calculating.</strong>
        <ul>${keys.map((k) => `<li><a href="#f-${k}" data-jump="${k}">${esc(ALL_FIELDS.find((f) => f.id === k).label)}</a> — ${esc(errors[k])}</li>`).join('')}</ul></div>`;
      alertBox.hidden = false;
      setStep(FIELD_SECTION[first]);
      $('#f-' + first).focus();
      return;
    }
    alertBox.hidden = true;
    state.calculated = true;
    save();
    navigate('dashboard');
    toast('Results calculated — estimates based on your inputs.');
  }

  function resetForm() {
    if (!window.confirm('Clear all inputs and start a new plan?')) return;
    const keepCurrency = state.inputs.currency;
    state.inputs = { ...DEFAULT_INPUTS, currency: keepCurrency };
    state.calculated = false;
    state.attempted = false;
    state.touched.clear();
    state.scen = null;
    $('#formAlert').hidden = true;
    $('#sampleSelect').value = '';
    syncFormFromState();
    setStep(0);
    updateLive();
    save();
    toast('Form cleared.');
    $('#f-businessName').focus();
  }

  function loadSample(id, goTo) {
    const s = SAMPLES.find((x) => x.id === id);
    if (!s) return;
    state.inputs = { ...DEFAULT_INPUTS };
    Object.entries(s.data).forEach(([k, v]) => (state.inputs[k] = String(v)));
    state.calculated = true;
    state.attempted = false;
    state.touched.clear();
    state.scen = null;
    $('#formAlert').hidden = true;
    syncFormFromState();
    updateLive();
    save();
    toast(`Sample loaded: ${s.data.businessName}`);
    if (goTo) navigate(goTo);
  }

  function bindForm() {
    const form = $('#planForm');
    form.addEventListener('input', onFieldInput);
    form.addEventListener('change', onFieldInput);
    form.addEventListener('focusout', (e) => {
      if (e.target.name && e.target.name in DEFAULT_INPUTS) {
        state.touched.add(e.target.name);
        showFieldErrors();
      }
    });
    form.addEventListener('submit', (e) => e.preventDefault());
    $('#stepper').addEventListener('click', (e) => {
      const b = e.target.closest('[data-step]');
      if (b) setStep(+b.dataset.step);
    });
    $('#prevStep').addEventListener('click', () => setStep(state.step - 1));
    $('#nextStep').addEventListener('click', () => {
      if (state.step === FORM.length - 1) calculateAndShow();
      else {
        setStep(state.step + 1);
        $('.form-section:not([hidden]) input, .form-section:not([hidden]) select').focus({ preventScroll: true });
        $('.planner-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    $('#calcBtn').addEventListener('click', calculateAndShow);
    $('#resetBtn').addEventListener('click', resetForm);
    $('#sampleSelect').addEventListener('change', (e) => {
      if (e.target.value) loadSample(e.target.value, null);
    });
    $('#formAlert').addEventListener('click', (e) => {
      const a = e.target.closest('[data-jump]');
      if (!a) return;
      e.preventDefault();
      setStep(FIELD_SECTION[a.dataset.jump]);
      $('#f-' + a.dataset.jump).focus();
    });
  }

  // Delegated buttons used across views
  document.addEventListener('click', (e) => {
    const s = e.target.closest('[data-load-sample]');
    if (s) loadSample(s.dataset.loadSample, 'dashboard');
    const g = e.target.closest('[data-goto]');
    if (g) {
      focusPanelOnShow = true;
      navigate(g.dataset.goto);
    }
    if (e.target.closest('[data-print]')) window.print();
  });

  /* ================================================================== */
  /* Results helpers                                                     */
  /* ================================================================== */

  /** Returns { r, ok, errors } for the current inputs. */
  function current() {
    const errors = Calc.validate(state.inputs);
    return { r: Calc.calculate(state.inputs), ok: state.calculated && Object.keys(errors).length === 0, errors };
  }

  function emptyState(title, text) {
    return `<div class="empty-state">${icon('chart')}<h2>${esc(title)}</h2><p>${esc(text)}</p>
      <div class="empty-actions">
        <button class="btn btn-primary" type="button" data-goto="planner">${icon('plan')} Open the planner</button>
        <button class="btn btn-quiet" type="button" data-load-sample="candles">Load sample business</button>
      </div></div>`;
  }
  function notReady(view) {
    const { errors } = current();
    if (state.calculated && Object.keys(errors).length)
      return emptyState('Some inputs need attention', 'A required value is missing or invalid (for example the selling price or expected sales). Fix it in the planner and your results will appear here.');
    const msg = {
      dashboard: 'Fill in the planner and press “Calculate results” to see your investment, costs, profit and break-even point.',
      scenarios: 'Scenarios compare “what if” changes against your plan. Calculate a plan first.',
      insights: 'The AI insights engine needs a calculated plan to analyse.',
    };
    return emptyState('No results yet', msg[view]);
  }

  const bizName = () => String(state.inputs.businessName || '').trim() || 'Your business';

  function warningAlerts(r) {
    const out = [];
    if (r.warnings.includes('PRICE_BELOW_UNIT_COST'))
      out.push(['bad', 'Selling price is below the cost per unit',
        `You sell at ${money(r.price)} but each unit costs ${money(r.variableCostPerUnit)} to make, so every sale loses ${money(r.variableCostPerUnit - r.price)}. Raise the price above ${money(r.variableCostPerUnit)} or reduce per-unit costs.`]);
    if (r.warnings.includes('NO_CONTRIBUTION'))
      out.push(['bad', 'Fees and tax leave nothing from each sale',
        `After fees and tax (${pctF(r.deductionRate * 100)} of the price), each sale no longer covers its own cost of ${money(r.variableCostPerUnit)}.`]);
    if (r.warnings.includes('DEDUCTIONS_TOO_HIGH'))
      out.push(['bad', 'Fees + tax are 100% or more', 'Please check the fee and tax percentages in Sales & Pricing.']);
    if (r.warnings.includes('BELOW_BREAK_EVEN'))
      out.push(['warn', 'Expected sales are below break-even',
        `You expect ${numF(r.units)} units a month but need about ${numF(r.breakEvenUnits)} to cover all costs.`]);
    return out
      .map(([tone, t, d]) => `<div class="alert alert-${tone}" role="note">${icon('alert')}<div><strong>${esc(t)}</strong><p>${esc(d)}</p></div></div>`)
      .join('');
  }

  /* ================================================================== */
  /* Home                                                                */
  /* ================================================================== */

  let homeDone = false;
  function renderHome() {
    if (homeDone) return;
    homeDone = true;
    const demo = SAMPLES[0];
    const r = Calc.calculate(demo.data);
    $('#heroBiz').textContent = demo.data.businessName;
    $('#heroProfit').textContent = '+' + money(r.profit, 'INR');
    $('#heroInvest').textContent = money(r.startupInvestment, 'INR');
    $('#heroMargin').textContent = pctF(r.margin);
    $('#heroBE').textContent = `${r.breakEvenUnits} units/mo`;
    $('#heroScore').textContent = `${AI.healthScore(r).score} / 100`;

    const badge = { candles: ['badge-good', 'Profit'], tiffin: ['badge-bad', 'Loss'], soap: ['badge-warn', 'Under-priced'] };
    $('#homeSamples').innerHTML = SAMPLES.map(
      (s) => `<button type="button" class="btn" data-load-sample="${s.id}">${esc(s.data.businessName)}
        <span class="badge ${badge[s.id][0]}">${badge[s.id][1]}</span></button>`
    ).join('');
  }

  /* ================================================================== */
  /* Dashboard                                                           */
  /* ================================================================== */

  function kpi({ label, ic, value, sub, tag, cls = '', extra = '' }) {
    return `<article class="kpi ${cls}">
      <div class="kpi-top"><span class="kpi-label">${icon(ic)}${esc(label)}</span>${tag || ''}</div>
      <p class="kpi-value">${value}</p>${extra}
      <p class="kpi-sub">${sub}</p></article>`;
  }

  function renderDashboard() {
    const root = $('#dashboardRoot');
    const { r, ok } = current();
    if (!ok) {
      root.innerHTML = notReady('dashboard');
      return;
    }
    const once = '<span class="tag tag-once">one-time</span>';
    const monthly = '<span class="tag tag-month">monthly</span>';
    const pos = r.profit >= 0;

    // Status banner
    let banner;
    if (r.status === 'profit') {
      banner = ['good', 'check', `Estimated monthly profit of ${money(r.profit)}`,
        `Your plan makes money on paper with a ${pctF(r.margin)} margin.${r.safetyMargin !== null ? ` Sales could fall ${pctF(r.safetyMargin)} before you reach break-even.` : ''}`];
    } else if (r.status === 'loss') {
      banner = ['bad', 'x', `Estimated monthly loss of ${money(-r.profit)}`,
        `Costs are higher than revenue. ${r.breakEvenUnits !== null
          ? `You'd need about ${numF(r.breakEvenUnits)} units a month to break even`
          : 'At this price each sale doesn’t cover its own cost, so selling more won’t help'}${
          r.breakEvenPrice !== null ? `, or a price of about ${money(r.breakEvenPrice)} at your planned sales.` : '.'}`];
    } else {
      banner = ['warn', 'info', 'Right at break-even', 'Revenue just covers your costs — no profit, no loss.'];
    }

    const marginW = r.margin === null ? 0 : Math.min(Math.abs(r.margin), 50) * 2;
    let beSub;
    if (r.breakEvenUnits === null) beSub = 'Each sale doesn’t cover its own cost';
    else if (r.units >= r.breakEvenUnits) beSub = `Your plan: ${numF(r.units)} units — ${pctF(r.safetyMargin)} cushion`;
    else beSub = `Your plan: ${numF(r.units)} units — ${numF(r.breakEvenUnits - r.units)} short`;

    const kpis = [
      kpi({ label: 'Startup investment', ic: 'coins', tag: once, value: money(r.startupInvestment),
        sub: `One-time costs ${money(r.oneTimeCosts)} + first stock ${money(r.initialInventoryCost)}` }),
      kpi({ label: 'Monthly revenue', ic: 'tag', tag: monthly, value: money(r.revenue),
        sub: `${money(r.price)} × ${numF(r.units)} units` }),
      kpi({ label: 'Monthly costs', ic: 'calendar', tag: monthly, value: money(r.monthlyTotalCost),
        sub: `Fixed ${moneyC(r.monthlyFixedCosts)} + variable ${moneyC(r.variableCosts)} + fees & tax ${moneyC(r.fees + r.tax)}` }),
      kpi({ label: pos ? 'Monthly profit' : 'Monthly loss', ic: pos ? 'check' : 'x', tag: monthly, cls: pos ? 'is-profit' : 'is-loss',
        value: signed(r.profit), sub: 'Revenue − total monthly costs (before income tax)' }),
      kpi({ label: 'Profit margin', ic: 'target', value: pctF(r.margin), cls: r.margin !== null && r.margin < 0 ? 'is-loss' : '',
        extra: `<div class="meter" aria-hidden="true"><span style="width:${marginW}%;background:var(${pos ? '--good' : '--bad'})"></span></div>`,
        sub: r.margin === null ? 'Not available when revenue is 0' : 'Share of each ₹/$ of sales you keep' }),
      kpi({ label: 'Break-even units', ic: 'chart', tag: monthly,
        value: r.breakEvenUnits === null ? 'Not reachable' : `${numF(r.breakEvenUnits)} <small style="font-size:.55em;font-weight:700;color:var(--ink-3)">units</small>`,
        sub: esc(beSub) }),
    ].join('');

    const minis = `
      <div class="mini"><p>Variable cost / unit</p><strong>${money(r.variableCostPerUnit)}</strong></div>
      <div class="mini"><p>Full cost / unit (at plan volume)</p><strong>${money(r.fullCostPerUnit)}</strong></div>
      <div class="mini"><p>Suggested price (${pctF(r.targetMargin)} margin)</p><strong>${money(r.suggestedPrice)}</strong></div>
      <div class="mini"><p>Payback period</p><strong>${r.paybackMonths === null ? 'Not while in loss' : r.paybackMonths.toFixed(1) + ' months'}</strong></div>`;

    const costSegments = [
      { label: 'Fixed costs', value: r.monthlyFixedCosts, color: 'var(--s2)' },
      { label: 'Variable costs', value: r.variableCosts, color: 'var(--s3)' },
      { label: 'Platform & payment fees', value: r.fees, color: 'var(--s4)' },
      { label: 'Tax', value: r.tax, color: 'var(--s5)' },
    ];
    const sb = r.startupBreakdown;
    const investSegments = [
      { label: 'Equipment & tools', value: sb.equipment, color: 'var(--s1)' },
      { label: 'Registration & licences', value: sb.registration, color: 'var(--s2)' },
      { label: 'Workspace setup', value: sb.setup, color: 'var(--s3)' },
      { label: 'Launch marketing', value: sb.marketing, color: 'var(--s4)' },
      { label: 'Other one-time', value: sb.otherStartup, color: 'var(--s5)' },
      { label: 'Initial inventory', value: r.initialInventoryCost, color: 'var(--s6)' },
    ];

    // Monthly P&L statement rows
    const fixedLabels = { rent: 'Rent', salaries: 'Salaries', utilities: 'Utilities', subscriptions: 'Subscriptions', otherMonthly: 'Other monthly costs' };
    const fixedRows = Object.entries(r.fixedBreakdown)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `<tr class="minus"><td>Less: ${fixedLabels[k]}</td><td>fixed</td><td>−${money(v)}</td></tr>`)
      .join('') || `<tr class="minus"><td>Less: fixed costs</td><td>fixed</td><td>${money(0)}</td></tr>`;
    const contribution = r.revenue - r.variableCosts - r.fees - r.tax;

    const projection = Calc.projection(r, 12);

    root.innerHTML = `
      <header class="page-head">
        <div>
          <p class="eyebrow-dark">Results dashboard · estimates</p>
          <h1 class="page-title">${esc(bizName())}</h1>
          <p class="page-sub">${esc(String(state.inputs.productName || '').trim() || 'Your product')} · ${esc(currency().code)} · updates live when you edit the planner</p>
        </div>
        <div class="head-actions">
          <button class="btn btn-quiet" type="button" data-goto="planner">${icon('plan')} Edit inputs</button>
          <button class="btn btn-primary" type="button" data-goto="scenarios">${icon('compare')} Compare scenarios</button>
        </div>
      </header>

      <div class="status-banner ${banner[0]}" role="status">
        <span class="sb-icon">${icon(banner[1])}</span>
        <div><h2>${esc(banner[2])}</h2><p>${esc(banner[3])}</p></div>
      </div>
      ${warningAlerts(r)}

      <div class="kpi-grid">${kpis}</div>
      <div class="mini-grid">${minis}</div>

      <div class="chart-grid">
        <section class="card" aria-labelledby="c1">
          <div class="card-head"><div><h2 class="card-title" id="c1">Revenue vs costs</h2><p class="card-sub">One typical month at your expected sales</p></div>${monthly}</div>
          ${Charts.revenueVsCost(r, money, moneyC)}
        </section>
        <section class="card" aria-labelledby="c2">
          <div class="card-head"><div><h2 class="card-title" id="c2">Break-even chart</h2><p class="card-sub">Where the revenue line crosses the cost line. Hover to explore.</p></div>${monthly}</div>
          ${Charts.breakEven(r, money, moneyC, numF)}
        </section>
        <section class="card" aria-labelledby="c3">
          <div class="card-head"><div><h2 class="card-title" id="c3">Where your monthly money goes</h2><p class="card-sub">Recurring costs, split by type</p></div>${monthly}</div>
          ${Charts.donut(costSegments, 'Monthly costs', moneyC(r.monthlyTotalCost), money)}
        </section>
        <section class="card" aria-labelledby="c4">
          <div class="card-head"><div><h2 class="card-title" id="c4">Startup investment breakdown</h2><p class="card-sub">Money needed once, before you open</p></div>${once}</div>
          ${Charts.donut(investSegments, 'Investment', moneyC(r.startupInvestment), money)}
        </section>
        <section class="card" style="grid-column:1/-1" aria-labelledby="c5">
          <div class="card-head"><div><h2 class="card-title" id="c5">12-month cash position</h2>
            <p class="card-sub">Starts at minus your startup investment, then adds each month's ${pos ? 'profit' : 'loss'}.${
              r.paybackMonths !== null ? ` Investment recovered around month ${Math.ceil(r.paybackMonths)}.` : ''}</p></div></div>
          ${Charts.cashflow(projection, money, moneyC)}
        </section>
        <section class="card" style="grid-column:1/-1" aria-labelledby="c6">
          <div class="card-head"><div><h2 class="card-title" id="c6">Monthly profit &amp; loss summary</h2><p class="card-sub">Read top to bottom, like a bank statement</p></div>${monthly}</div>
          <div class="table-scroll"><table class="statement">
            <thead><tr><th scope="col">Item</th><th scope="col">How</th><th scope="col">Amount</th></tr></thead>
            <tbody>
              <tr><td><strong>Revenue</strong></td><td>${money(r.price)} × ${numF(r.units)} units</td><td><strong>${money(r.revenue)}</strong></td></tr>
              <tr class="minus"><td>Less: variable costs</td><td>${money(r.variableCostPerUnit)} × ${numF(r.units)}</td><td>−${money(r.variableCosts)}</td></tr>
              <tr class="minus"><td>Less: platform &amp; payment fees</td><td>${pctF(r.feeRate * 100)} of revenue</td><td>−${money(r.fees)}</td></tr>
              <tr class="minus"><td>Less: tax on sales</td><td>${pctF(r.taxRate * 100)} of revenue</td><td>−${money(r.tax)}</td></tr>
              <tr class="subtotal-row"><td>Contribution (left to pay fixed costs)</td><td>${money(r.contributionPerUnit)} per unit</td><td>${money(contribution)}</td></tr>
              ${fixedRows}
              <tr class="total-row"><td>Estimated monthly ${pos ? 'profit' : 'loss'}</td><td>margin ${pctF(r.margin)}</td><td class="${pos ? 'pos' : 'neg'}">${signed(r.profit)}</td></tr>
            </tbody>
          </table></div>
          <p class="card-sub" style="margin-top:12px">Not in the monthly P&amp;L: one-time startup investment of <strong>${money(r.startupInvestment)}</strong>.</p>
        </section>
      </div>

      <div class="dash-actions">
        <button class="btn btn-quiet" type="button" data-goto="insights">${icon('spark')} See AI insights</button>
        <button class="btn btn-quiet" type="button" data-goto="method">${icon('book')} How this is calculated</button>
        <button class="btn btn-quiet" type="button" data-print>${icon('print')} Print / save as PDF</button>
      </div>
      <p class="disclaimer">${icon('info')}<span>These figures are estimates based only on the numbers you entered. Real results depend on demand, actual costs, seasonality and execution. They are not guaranteed outcomes or financial advice.</span></p>`;

    bindBreakEvenHover(root);
  }

  /* ================================================================== */
  /* Scenarios                                                           */
  /* ================================================================== */

  const PRESETS = [
    { id: 'pess', label: 'Pessimistic', note: '−25% sales', v: { units: 0.75 } },
    { id: 'opt', label: 'Optimistic', note: '+25% sales', v: { units: 1.25 } },
    { id: 'premium', label: 'Premium', note: '+15% price, −10% sales', v: { price: 1.15, units: 0.9 } },
    { id: 'discount', label: 'Discount', note: '−10% price, +20% sales', v: { price: 0.9, units: 1.2 } },
    { id: 'lean', label: 'Lean costs', note: '−10% unit & fixed costs', v: { unitCost: -10, fixed: -10 } },
  ];

  function baseValues() {
    return { price: Calc.num(state.inputs.price), units: Calc.num(state.inputs.units) };
  }

  /** Make sure the scenario sliders exist and match the current base plan. */
  function ensureScen() {
    const b = baseValues();
    if (!state.scen || state.scen.basePrice !== b.price || state.scen.baseUnits !== b.units) {
      state.scen = { price: b.price, units: b.units, unitCost: 0, fixed: 0, basePrice: b.price, baseUnits: b.units };
    }
    return state.scen;
  }
  const roundPrice = (v, base) => (base >= 100 ? Math.round(v) : Math.round(v * 100) / 100);

  function scenResult(s = state.scen) {
    return Calc.scenario(state.inputs, {
      priceFactor: s.basePrice > 0 ? s.price / s.basePrice : 1,
      unitsFactor: s.baseUnits > 0 ? s.units / s.baseUnits : 1,
      unitCostFactor: 1 + s.unitCost / 100,
      fixedCostFactor: 1 + s.fixed / 100,
    });
  }

  function presetScen(p) {
    const b = ensureScen();
    return {
      ...b,
      price: roundPrice(b.basePrice * (p.v.price || 1), b.basePrice),
      units: Math.round(b.baseUnits * (p.v.units || 1)),
      unitCost: p.v.unitCost || 0,
      fixed: p.v.fixed || 0,
    };
  }

  function deltaCell(a, b, f, higherIsGood = true) {
    if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) return '<span class="delta flat">—</span>';
    const d = b - a;
    if (Math.abs(d) < 0.005) return '<span class="delta flat">no change</span>';
    const good = higherIsGood ? d > 0 : d < 0;
    return `<span class="delta ${good ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${f(Math.abs(d))}</span>`;
  }

  function sliderHTML(id, label, value, min, max, step, display, delta, scale) {
    return `<div class="slider-field">
      <div class="slider-top"><label for="${id}">${esc(label)}</label>
        <span><span class="slider-val" id="${id}-val">${display}</span><span class="slider-delta" id="${id}-delta">${delta}</span></span></div>
      <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" aria-describedby="${id}-val ${id}-delta" />
      <div class="slider-scale" aria-hidden="true"><span>${scale[0]}</span><span>${scale[1]}</span></div>
    </div>`;
  }
  const pctDelta = (v, base) => (base > 0 ? `${v >= base ? '+' : '−'}${pctF(Math.abs((v / base - 1) * 100))}` : '');

  function renderScenarios() {
    const root = $('#scenariosRoot');
    const { ok } = current();
    if (!ok) {
      root.innerHTML = notReady('scenarios');
      return;
    }
    const s = ensureScen();
    const pMin = roundPrice(s.basePrice * 0.5, s.basePrice), pMax = roundPrice(s.basePrice * 2, s.basePrice);
    const pStep = s.basePrice >= 100 ? 1 : 0.01;
    const uMax = Math.max(10, Math.ceil(s.baseUnits * 3));

    // Sensitivity grid: price −20…+20 % (rows) × sales −40…+40 % (cols)
    const pSteps = [0.2, 0.1, 0, -0.1, -0.2];
    const uSteps = [-0.4, -0.2, 0, 0.2, 0.4];
    const grid = Calc.sensitivityGrid(state.inputs, pSteps, uSteps);
    const maxAbs = Math.max(1, ...grid.flat().map(Math.abs));
    const heat = `<table class="heat">
      <caption>Green = estimated monthly profit, red = loss. Darker = larger. Outlined cell = your current plan.</caption>
      <thead><tr><th scope="col">Price ↓ / Sales →</th>${uSteps.map((u) => `<th scope="col">${u === 0 ? 'Plan' : (u > 0 ? '+' : '−') + Math.abs(u * 100) + '%'}<br><span class="muted">${numF(Math.round(s.baseUnits * (1 + u)))}</span></th>`).join('')}</tr></thead>
      <tbody>${grid.map((row, i) => `<tr><th scope="row">${pSteps[i] === 0 ? 'Plan' : (pSteps[i] > 0 ? '+' : '−') + Math.abs(pSteps[i] * 100) + '%'}<br><span class="muted">${money(s.basePrice * (1 + pSteps[i]))}</span></th>${row
        .map((v, j) => {
          const a = 0.12 + 0.7 * Math.min(1, Math.abs(v) / maxAbs);
          const col = v >= 0 ? `rgba(12,163,12,${a.toFixed(2)})` : `rgba(208,59,59,${a.toFixed(2)})`;
          return `<td class="${pSteps[i] === 0 && uSteps[j] === 0 ? 'base' : ''} ${a > 0.55 ? 'on-dark' : ''}" style="background:${col}" title="${esc(money(v))}">${esc(signed(v, moneyC))}</td>`;
        })
        .join('')}</tr>`).join('')}</tbody></table>`;

    root.innerHTML = `
      <header class="page-head">
        <div>
          <p class="eyebrow-dark">What-if analysis</p>
          <h1 class="page-title">Compare scenarios</h1>
          <p class="page-sub">Move the sliders to test a different price, sales volume or cost level. Your saved plan stays unchanged.</p>
        </div>
      </header>

      <div class="scen-grid">
        <section class="card" aria-labelledby="sc1">
          <div class="card-head"><div><h2 class="card-title" id="sc1">Adjust assumptions</h2><p class="card-sub">Quick presets</p></div></div>
          <div class="presets" role="group" aria-label="Scenario presets">
            ${PRESETS.map((p) => `<button type="button" class="chip" data-preset="${p.id}" aria-pressed="false" title="${esc(p.note)}">${esc(p.label)}</button>`).join('')}
          </div>
          ${sliderHTML('sl-price', 'Selling price per unit', s.price, pMin, pMax, pStep, money(s.price), pctDelta(s.price, s.basePrice), [money(pMin), money(pMax)])}
          ${sliderHTML('sl-units', 'Units sold per month', s.units, 0, uMax, 1, numF(s.units), pctDelta(s.units, s.baseUnits), ['0', numF(uMax)])}
          ${sliderHTML('sl-unitCost', 'Change in per-unit costs', s.unitCost, -50, 50, 1, (s.unitCost > 0 ? '+' : '') + s.unitCost + '%', '', ['−50%', '+50%'])}
          ${sliderHTML('sl-fixed', 'Change in monthly fixed costs', s.fixed, -50, 50, 1, (s.fixed > 0 ? '+' : '') + s.fixed + '%', '', ['−50%', '+50%'])}
          <button type="button" class="btn btn-quiet btn-block" id="scenReset">${icon('reset')} Back to my plan</button>
        </section>
        <div id="scenOut" aria-live="polite"></div>
      </div>

      <section class="card" aria-labelledby="sc3" style="margin-bottom:16px">
        <div class="card-head"><div><h2 class="card-title" id="sc3">Scenario line-up</h2><p class="card-sub">Estimated monthly profit or loss for common what-ifs</p></div></div>
        <div class="lineup" id="lineup"></div>
      </section>

      <section class="card" aria-labelledby="sc4" style="margin-bottom:16px">
        <div class="card-head"><div><h2 class="card-title" id="sc4">Price × sales sensitivity</h2><p class="card-sub">Monthly profit for every mix of price and sales changes</p></div></div>
        <div class="heat-wrap">${heat}</div>
      </section>

      <section class="card" aria-labelledby="sc5">
        <div class="card-head"><div><h2 class="card-title" id="sc5">Saved scenarios</h2><p class="card-sub">Stored only in this browser</p></div></div>
        <div class="save-row">
          <label class="sr-only" for="scenName">Scenario name</label>
          <div class="input-wrap"><input id="scenName" type="text" maxlength="40" placeholder="Name this scenario, e.g. Diwali pricing" /></div>
          <button type="button" class="btn btn-primary" id="scenSave">${icon('save')} Save current scenario</button>
        </div>
        <div id="savedList"></div>
      </section>`;

    const onSlide = () => {
      s.price = roundPrice(parseFloat($('#sl-price').value), s.basePrice);
      s.units = parseInt($('#sl-units').value, 10);
      s.unitCost = parseInt($('#sl-unitCost').value, 10);
      s.fixed = parseInt($('#sl-fixed').value, 10);
      updateScenOut();
    };
    $$('#scenariosRoot input[type="range"]').forEach((el) => el.addEventListener('input', onSlide));
    $$('[data-preset]', root).forEach((b) =>
      b.addEventListener('click', () => {
        Object.assign(s, presetScen(PRESETS.find((p) => p.id === b.dataset.preset)));
        syncSliders();
        updateScenOut();
      })
    );
    $('#scenReset').addEventListener('click', () => {
      Object.assign(s, { price: s.basePrice, units: s.baseUnits, unitCost: 0, fixed: 0 });
      syncSliders();
      updateScenOut();
    });
    $('#scenSave').addEventListener('click', saveScenario);
    $('#scenName').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveScenario();
    });
    updateScenOut();
    renderSaved();
  }

  function syncSliders() {
    const s = state.scen;
    $('#sl-price').value = s.price;
    $('#sl-units').value = s.units;
    $('#sl-unitCost').value = s.unitCost;
    $('#sl-fixed').value = s.fixed;
  }

  function updateScenOut() {
    const s = state.scen;
    const base = Calc.calculate(state.inputs);
    const sc = scenResult();

    $('#sl-price-val').textContent = money(s.price);
    $('#sl-price-delta').textContent = pctDelta(s.price, s.basePrice);
    $('#sl-units-val').textContent = numF(s.units);
    $('#sl-units-delta').textContent = pctDelta(s.units, s.baseUnits);
    $('#sl-unitCost-val').textContent = (s.unitCost > 0 ? '+' : '') + s.unitCost + '%';
    $('#sl-fixed-val').textContent = (s.fixed > 0 ? '+' : '') + s.fixed + '%';
    $$('[data-preset]').forEach((b) => {
      const p = presetScen(PRESETS.find((x) => x.id === b.dataset.preset));
      const same = p.price === s.price && p.units === s.units && p.unitCost === s.unitCost && p.fixed === s.fixed;
      b.setAttribute('aria-pressed', same ? 'true' : 'false');
    });

    const rows = [
      ['Selling price', base.price, sc.price, money, true],
      ['Units / month', base.units, sc.units, numF, true],
      ['Revenue', base.revenue, sc.revenue, money, true],
      ['Total monthly cost', base.monthlyTotalCost, sc.monthlyTotalCost, money, false],
      ['Profit / loss', base.profit, sc.profit, money, true],
      ['Profit margin', base.margin, sc.margin, (v) => pctF(v).replace('%', ' pts'), true],
      ['Break-even units', base.breakEvenUnits, sc.breakEvenUnits, numF, false],
    ];
    const good = sc.profit >= 0;
    const diff = sc.profit - base.profit;

    $('#scenOut').innerHTML = `
      <div class="scen-result">
        <div class="scen-box ${good ? 'good' : 'bad'}"><p>Scenario ${good ? 'profit' : 'loss'}</p><strong>${signed(sc.profit)}</strong><span>${good ? 'per month' : 'per month — costs exceed revenue'}, margin ${pctF(sc.margin)}</span></div>
        <div class="scen-box ${diff >= 0 ? 'good' : 'bad'}"><p>vs. your plan</p><strong>${signed(diff)}</strong><span>${Math.abs(diff) < 1 ? 'same as your plan' : diff > 0 ? 'better each month' : 'worse each month'}</span></div>
      </div>
      <section class="card" aria-labelledby="sc2">
        <div class="card-head"><div><h2 class="card-title" id="sc2">Plan vs scenario</h2><p class="card-sub">Estimated monthly figures</p></div></div>
        <div class="table-scroll"><table class="compare-table">
          <thead><tr><th scope="col">Metric</th><th scope="col">Your plan</th><th scope="col">Scenario</th><th scope="col">Change</th></tr></thead>
          <tbody>${rows
            .map(([label, a, b, f, hi]) => {
              const isProfit = label === 'Profit / loss';
              const isMargin = label === 'Profit margin';
              const show = (v) => (isMargin ? pctF(v) : isProfit ? signed(v) : v === null ? 'Not reachable' : f(v));
              return `<tr class="${isProfit ? 'hl' : ''}"><th scope="row">${label}</th><td>${show(a)}</td><td>${show(b)}</td><td>${deltaCell(a, b, f, hi)}</td></tr>`;
            })
            .join('')}</tbody>
        </table></div>
        ${sc.warnings.includes('PRICE_BELOW_UNIT_COST') ? `<div class="alert alert-bad" style="margin:14px 0 0">${icon('alert')}<p>In this scenario the price is below the cost to make one unit (${money(sc.variableCostPerUnit)}).</p></div>` : ''}
      </section>`;

    // Line-up bars
    const list = [
      { label: 'Your plan', note: 'as entered', r: base },
      ...PRESETS.map((p) => ({ label: p.label, note: p.note, r: scenResult(presetScen(p)) })),
      { label: 'Custom (sliders)', note: 'your current sliders', r: sc },
    ];
    const vals = list.map((l) => l.r.profit);
    const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals), span = hi - lo || 1;
    const zero = (-lo / span) * 100;
    $('#lineup').innerHTML = list
      .map((l) => {
        const v = l.r.profit;
        const w = (Math.abs(v) / span) * 100;
        const left = v >= 0 ? zero : zero - w;
        return `<div class="lineup-row"><span class="ll">${esc(l.label)}<small>${esc(l.note)}</small></span>
          <span class="lineup-track" aria-hidden="true"><span class="fill" style="left:${left}%;width:${w}%;background:var(${v >= 0 ? '--good' : '--bad'})"></span><span class="zero" style="left:${zero}%"></span></span>
          <span class="lv" style="color:var(${v >= 0 ? '--good-ink' : '--bad-ink'})">${signed(v, moneyC)}</span></div>`;
      })
      .join('');
  }

  function saveScenario() {
    const s = state.scen;
    const sc = scenResult();
    const nameEl = $('#scenName');
    const name = nameEl.value.trim() || `Scenario ${state.saved.length + 1}`;
    state.saved.unshift({
      id: Date.now(),
      name,
      biz: bizName(),
      currency: state.inputs.currency,
      price: s.price,
      units: s.units,
      unitCost: s.unitCost,
      fixed: s.fixed,
      profit: sc.profit,
      margin: sc.margin,
      be: sc.breakEvenUnits,
    });
    state.saved = state.saved.slice(0, 20);
    nameEl.value = '';
    save();
    renderSaved();
    toast(`Saved “${name}”.`);
  }

  function renderSaved() {
    const box = $('#savedList');
    if (!box) return;
    if (!state.saved.length) {
      box.innerHTML = '<p class="muted small" style="margin-top:12px">No saved scenarios yet. Adjust the sliders, give it a name and save it to compare later.</p>';
      return;
    }
    box.innerHTML = `<div class="table-scroll"><table class="saved-table">
      <thead><tr><th scope="col">Name</th><th scope="col">Price</th><th scope="col">Units</th><th scope="col">Costs</th><th scope="col">Profit / month</th><th scope="col">Margin</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
      <tbody>${state.saved
        .map(
          (x) => `<tr><td><strong>${esc(x.name)}</strong><br><span class="muted small">${esc(x.biz)}</span></td>
          <td>${money(x.price, x.currency)}</td><td>${numF(x.units)}</td>
          <td class="small">${x.unitCost || x.fixed ? `unit ${x.unitCost > 0 ? '+' : ''}${x.unitCost}%, fixed ${x.fixed > 0 ? '+' : ''}${x.fixed}%` : 'as plan'}</td>
          <td style="color:var(${x.profit >= 0 ? '--good-ink' : '--bad-ink'});font-weight:800">${(x.profit >= 0 ? '+' : '−') + money(Math.abs(x.profit), x.currency)}</td>
          <td>${pctF(x.margin)}</td>
          <td><button type="button" class="btn btn-danger-quiet" data-del="${x.id}" aria-label="Delete ${esc(x.name)}">${icon('trash')}</button></td></tr>`
        )
        .join('')}</tbody></table></div>`;
    $$('[data-del]', box).forEach((b) =>
      b.addEventListener('click', () => {
        state.saved = state.saved.filter((x) => String(x.id) !== b.dataset.del);
        save();
        renderSaved();
        toast('Scenario deleted.');
      })
    );
  }

  /* ================================================================== */
  /* AI Insights                                                         */
  /* ================================================================== */

  function renderInsights() {
    const root = $('#insightsRoot');
    const { r, ok } = current();
    if (!ok) {
      root.innerHTML = notReady('insights');
      return;
    }
    const a = AI.analyse(r, state.inputs, { money, num: numF, pct: pctF });
    const toneVar = { good: '--good', warn: '--warn', bad: '--bad' }[a.health.tone];
    const pillCls = { good: 'pill-good', warn: 'pill-warn', bad: 'pill-bad' }[a.health.tone];
    const parts = [
      ['Profit margin', a.health.parts.margin, 40],
      ['Safety cushion', a.health.parts.safety, 25],
      ['Payback speed', a.health.parts.payback, 20],
      ['Unit economics', a.health.parts.unitEcon, 15],
    ];
    const kind = { good: ['check', 'Strength'], bad: ['x', 'Risk'], warn: ['alert', 'Watch out'], tip: ['bulb', 'Recommendation'] };
    const filters = [
      ['all', 'All', a.items.length],
      ['good', 'Strengths', a.counts.good || 0],
      ['risk', 'Risks', (a.counts.bad || 0) + (a.counts.warn || 0)],
      ['tip', 'Recommendations', a.counts.tip || 0],
    ];
    const maxGain = Math.max(1, ...a.levers.map((l) => Math.abs(l.gain)));

    root.innerHTML = `
      <header class="page-head">
        <div>
          <p class="eyebrow-dark">AI Insights</p>
          <h1 class="page-title">Business health check</h1>
          <p class="page-sub">Profitlo's on-device AI engine reads your numbers like an advisor would: it scores the plan, flags risks and suggests what to change first.</p>
        </div>
        <span class="ai-badge">${icon('spark')} On-device AI engine</span>
      </header>

      <div class="ins-top">
        <section class="card" aria-labelledby="in1">
          <h2 class="card-title" id="in1" style="margin-bottom:12px">Health score for ${esc(bizName())}</h2>
          <div class="health">
            ${Charts.gauge(a.health.score, toneVar)}
            <div>
              <span class="pill ${pillCls}">${esc(a.health.grade)}</span>
              <p style="margin:10px 0 0;color:var(--ink-2)">${esc(a.headline)}</p>
              <ul class="score-parts">${parts
                .map(([l, v, m]) => `<li><span>${l}</span><span class="meter"><span style="width:${(v / m) * 100}%;background:var(--s1)"></span></span><b>${Math.round(v)}/${m}</b></li>`)
                .join('')}</ul>
            </div>
          </div>
        </section>
        <section class="card" aria-labelledby="in2">
          <div class="card-head"><div><h2 class="card-title" id="in2">How much money to arrange</h2><p class="card-sub">Startup investment plus a cushion while sales ramp up</p></div><span class="tag tag-once">one-time</span></div>
          <dl class="capital-list">
            <div><dt>Startup investment</dt><dd>${money(a.capital.investment)}</dd></div>
            <div><dt>Safety reserve (3 months of fixed costs)</dt><dd>${money(a.capital.reserve)}</dd></div>
            <div class="cap-total"><dt>Recommended total capital</dt><dd>${money(a.capital.total)}</dd></div>
          </dl>
          <p class="card-sub" style="margin-top:10px">A reserve keeps rent and salaries paid if the first months are slower than planned.</p>
        </section>
      </div>

      <div class="ins-filter" role="group" aria-label="Filter insights">
        ${filters.map(([id, l, n]) => `<button type="button" class="chip" data-filter="${id}" aria-pressed="${state.insFilter === id}">${l} <span class="muted">${n}</span></button>`).join('')}
      </div>
      <div class="ins-grid" id="insList">
        ${a.items
          .map(
            (it) => `<article class="ins-item ${it.tone}" data-tone="${it.tone}">
              <span class="ii-icon">${icon(kind[it.tone][0])}</span>
              <div><span class="ii-kind">${kind[it.tone][1]}</span><h3>${esc(it.title)}</h3><p>${esc(it.text)}</p></div></article>`
          )
          .join('')}
      </div>

      <section class="card" aria-labelledby="in3">
        <div class="card-head"><div><h2 class="card-title" id="in3">What moves the needle</h2><p class="card-sub">Extra monthly profit from one 10% change, simulated on your plan</p></div></div>
        <div class="levers">${a.levers
          .map(
            (l, i) => `<div class="lever"><span><span class="rank">${i + 1}</span>${esc(l.label)}</span>
              <span class="lv-bar" aria-hidden="true"><span style="width:${(Math.max(0, l.gain) / maxGain) * 100}%"></span></span>
              <b style="color:var(${l.gain >= 0 ? '--good-ink' : '--bad-ink'})">${signed(l.gain)}/mo</b></div>`
          )
          .join('')}</div>
      </section>

      <p class="disclaimer">${icon('info')}<span>Insights are generated in your browser by Profitlo's rule-based AI engine from the figures you entered — nothing is sent to a server. They are guidance for planning, not professional financial advice.</span></p>`;

    const applyFilter = () => {
      $$('#insList .ins-item').forEach((el) => {
        const t = el.dataset.tone;
        const f = state.insFilter;
        el.hidden = !(f === 'all' || f === t || (f === 'risk' && (t === 'bad' || t === 'warn')));
      });
      $$('[data-filter]', root).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === state.insFilter)));
    };
    $$('[data-filter]', root).forEach((b) =>
      b.addEventListener('click', () => {
        state.insFilter = b.dataset.filter;
        applyFilter();
      })
    );
    applyFilter();
  }

  /* ================================================================== */
  /* How it works (formulas with the user's own numbers)                 */
  /* ================================================================== */

  function renderMethod() {
    const root = $('#methodRoot');
    const { r: mine, ok } = current();
    const useSample = !ok;
    const inputs = useSample ? SAMPLES[0].data : state.inputs;
    const r = useSample ? Calc.calculate(inputs) : mine;
    const m = (v) => money(v, useSample ? 'INR' : undefined);
    const ub = r.unitBreakdown;

    const F = [
      ['Variable cost per unit', 'raw materials + packaging + labour + delivery + other per-unit costs',
        'Everything you spend to make and deliver one unit.',
        `${[ub.rawMaterials, ub.packaging, ub.labor, ub.delivery, ub.otherUnit].map(m).join(' + ')} = ${m(r.variableCostPerUnit)}`],
      ['Revenue (monthly)', 'selling price × units sold per month', 'Money coming in from sales, before any costs.',
        `${m(r.price)} × ${numF(r.units)} = ${m(r.revenue)}`],
      ['Monthly total cost', 'fixed costs + (variable cost per unit × units) + fees + tax\nfees = revenue × fee %   ·   tax = revenue × tax %',
        'All money going out in a month. Fixed costs stay the same; variable costs, fees and tax grow with sales.',
        `${m(r.monthlyFixedCosts)} + (${m(r.variableCostPerUnit)} × ${numF(r.units)}) + ${m(r.fees)} + ${m(r.tax)} = ${m(r.monthlyTotalCost)}`],
      ['Monthly profit or loss', 'revenue − monthly total cost', 'Positive = profit, negative = loss.',
        `${m(r.revenue)} − ${m(r.monthlyTotalCost)} = ${(r.profit < 0 ? '−' : '') + m(Math.abs(r.profit))}`],
      ['Profit margin', 'profit ÷ revenue × 100   (only when revenue > 0)', 'How much of every sale you keep as profit.',
        r.revenue > 0 ? `${m(r.profit)} ÷ ${m(r.revenue)} × 100 = ${pctF(r.margin)}` : 'Revenue is 0, so margin is not shown (no divide-by-zero).'],
      ['Startup investment (one-time)', 'one-time startup costs + (initial inventory units × variable cost per unit)',
        'Money needed once before you open. It is NOT part of the monthly costs.',
        `${m(r.oneTimeCosts)} + (${numF(r.inventoryUnits)} × ${m(r.variableCostPerUnit)}) = ${m(r.startupInvestment)}`],
      ['Break-even units', 'monthly fixed costs ÷ (selling price − variable cost per unit − fees & tax per unit)\n→ rounded UP to a whole unit',
        'Units you must sell each month to cover all costs. With no fees or tax it is exactly fixed costs ÷ (price − variable cost).',
        r.breakEvenUnits === null
          ? `${m(r.price)} − ${m(r.variableCostPerUnit)} − ${m(r.deductionsPerUnit)} = ${m(r.contributionPerUnit)} per unit, which is not positive → break-even is not reachable at this price.`
          : `${m(r.monthlyFixedCosts)} ÷ (${m(r.price)} − ${m(r.variableCostPerUnit)} − ${m(r.deductionsPerUnit)}) = ${(r.monthlyFixedCosts / r.contributionPerUnit).toFixed(2)} → ${numF(r.breakEvenUnits)} units`],
      ['Suggested selling price', '(variable cost per unit + fixed costs ÷ units) ÷ (1 − fee % − tax % − target margin %)',
        'The price that would give your target margin at your expected sales.',
        r.suggestedPrice === null ? 'Needs expected units > 0 and fee + tax + target margin below 100%.'
          : `(${m(r.variableCostPerUnit)} + ${m(r.monthlyFixedCosts)} ÷ ${numF(r.units)}) ÷ (1 − ${pctF(r.feeRate * 100)} − ${pctF(r.taxRate * 100)} − ${pctF(r.targetMargin)}) = ${m(r.suggestedPrice)}`],
      ['Payback period', 'startup investment ÷ monthly profit', 'Months of steady profit needed to earn back what you invested.',
        r.paybackMonths === null ? 'Only calculated when the business makes a monthly profit.' : `${m(r.startupInvestment)} ÷ ${m(r.profit)} = ${r.paybackMonths.toFixed(1)} months`],
      ['AI health score (0–100)', 'margin (40) + safety cushion (25) + payback speed (20) + unit economics (15)',
        'Full marks at ≥ 25% margin, ≥ 40% above break-even, ≤ 6-month payback and each sale keeping ≥ 50% of its price.',
        `${AI.healthScore(r).score} / 100 for ${useSample ? 'the sample business' : bizName()}`],
    ];

    root.innerHTML = `
      <header class="page-head">
        <div>
          <p class="eyebrow-dark">Transparent maths</p>
          <h1 class="page-title">How this is calculated</h1>
          <p class="page-sub">${useSample
            ? 'Shown with the sample business <strong>Aroma Candle Co.</strong> Calculate your own plan to see your numbers here.'
            : `Every formula below uses <strong>${esc(bizName())}</strong>'s numbers, so you can check each result by hand.`}</p>
        </div>
      </header>

      <div class="formula-grid">${F.map(
        ([t, f, d, y], i) => `<article class="formula"><h3><span class="f-no">${i + 1}</span>${esc(t)}</h3>
          <code>${esc(f)}</code><p>${esc(d)}</p><p class="f-yours"><strong>${useSample ? 'Example' : 'Your numbers'}:</strong> ${esc(y)}</p></article>`
      ).join('')}</div>

      <div class="split">
        <section class="card"><h3>${icon('coins')} One-time vs monthly</h3>
          <ul>
            <li><strong>One-time (startup investment):</strong> equipment, registration, setup, launch marketing and your first stock. Paid once.</li>
            <li><strong>Monthly fixed:</strong> rent, salaries, utilities, subscriptions — paid every month, even with zero sales.</li>
            <li><strong>Monthly variable:</strong> per-unit costs × units sold, plus fees and tax — these rise and fall with sales.</li>
            <li>Profit and margin are <em>monthly</em>; the payback period connects the two.</li>
          </ul>
        </section>
        <section class="card"><h3>${icon('shield')} Safe handling of tricky inputs</h3>
          <ul>
            <li>Empty fields count as 0. Text, negative numbers and percentages above 100 are flagged with a message.</li>
            <li>No divide-by-zero: margin shows “—” when revenue is 0; cost per unit needs units &gt; 0.</li>
            <li>If price ≤ cost per unit (after fees), break-even shows “Not reachable” and a warning explains why.</li>
            <li>Results are estimates, never guarantees.</li>
          </ul>
        </section>
      </div>

      <h2 class="block-title">Glossary for first-time founders</h2>
      <section class="card" style="margin-bottom:24px">
        <dl class="glossary">
          <div><dt>Fixed cost</dt><dd>A cost that stays the same every month, whatever you sell (e.g. rent).</dd></div>
          <div><dt>Variable cost</dt><dd>A cost per unit that grows as you sell more (e.g. raw materials).</dd></div>
          <div><dt>Contribution per unit</dt><dd>Price minus variable cost, fees and tax — what each sale adds toward fixed costs.</dd></div>
          <div><dt>Break-even point</dt><dd>The sales level where revenue equals total cost: no profit, no loss.</dd></div>
          <div><dt>Profit margin</dt><dd>Profit as a percentage of revenue. 20% means you keep ₹20 of every ₹100 sold.</dd></div>
          <div><dt>Margin of safety</dt><dd>How far sales can drop below your estimate before you make a loss.</dd></div>
          <div><dt>Payback period</dt><dd>How many months of profit it takes to earn back your startup investment.</dd></div>
          <div><dt>Working-capital reserve</dt><dd>Cash kept aside to pay fixed costs while sales grow.</dd></div>
        </dl>
      </section>

      <h2 class="block-title">About this project</h2>
      <section class="card">
        <p><strong>Profitlo</strong> is a B.Tech FLB project: an AI-based planner that helps small-business founders estimate investment, costs, pricing and profitability before spending money.</p>
        <div class="stack-list"><span>HTML5 (semantic)</span><span>CSS3 · Grid · custom properties</span><span>Vanilla JavaScript</span><span>Hand-built SVG charts</span><span>Rule-based AI insights engine</span><span>localStorage</span><span>No backend · no API keys</span></div>
      </section>`;
  }

  /* ================================================================== */
  /* Boot                                                                */
  /* ================================================================== */

  initTheme();
  load();
  renderForm();
  syncFormFromState();
  setStep(state.step);
  bindForm();
  updateLive();
  showView(viewFromHash());
})();
