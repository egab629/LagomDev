/**
 * Lagom waitlist — signup inbox (Google Apps Script web app).
 *
 * POST (from the waitlist form on the website): logs the signup to a Google
 * Sheet, one row per person.
 * GET (opened in a browser): the private admin page with signup counts by
 * total, state and model, plus the full list. Anyone signed in at
 * ADMIN_DOMAIN can view it.
 * This is its own Apps Script project, separate from the careers inbox.
 */

const ADMIN_DOMAIN = 'lagomdevelopment.com';
const LOG_NAME = 'Lagom Waitlist';
const MODELS = ['Model 1', 'Model 2', 'Model 3', 'Model 4', 'Model 5', 'Not sure yet'];
const STATES = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN',
  'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM',
  'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV',
  'WI', 'WY'];
const LOG_HEADERS = ['ID', 'Submitted', 'Name', 'Email', 'Street', 'City', 'State', 'ZIP', 'Model'];

/* ── Receiving signups ──────────────────────────────────────────────────── */

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.botcheck) return json({ success: true }); // honeypot tripped — drop quietly

    const name = clean(body.name, 200);
    const email = clean(body.email, 200).toLowerCase();
    const street = clean(body.street, 200);
    const city = clean(body.city, 100);
    const state = clean(body.state, 2).toUpperCase();
    const zip = clean(body.zip, 10);
    const model = clean(body.model, 50);
    if (!name) throw new Error('Please enter your name.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Please enter a valid email address.');
    if (!street || !city) throw new Error('Please enter your address.');
    if (!STATES.includes(state)) throw new Error('Please choose your state.');
    if (!/^\d{5}(-\d{4})?$/.test(zip)) throw new Error('Please enter a valid ZIP code.');
    if (!MODELS.includes(model)) throw new Error('Please choose a Lagom model.');

    withLock(() => {
      const sheet = logSheet();
      // The same person submitting twice (double click, retry) is only listed once per model.
      const rows = sheet.getDataRange().getValues();
      const dupe = rows.some((r, i) => i > 0 && String(r[3]).toLowerCase() === email && String(r[8]) === model);
      if (dupe) return;
      sheet.appendRow([Utilities.getUuid(), new Date(), safeCell(name), safeCell(email), safeCell(street),
        safeCell(city), state, "'" + zip, model]);
    });
    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ success: false, message: String((err && err.message) || err) });
  }
}

/* ── Admin page ─────────────────────────────────────────────────────────── */

function doGet() {
  const viewer = currentUser();
  if (!canView(viewer)) {
    return HtmlService.createHtmlOutput(
      '<div style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#1e2420">' +
      '<h2 style="font-weight:600">You don\'t have access to this page</h2>' +
      '<p>The Lagom waitlist can only be viewed by people signed in to Google with an @' +
      ADMIN_DOMAIN + ' account.</p>' +
      (viewer ? '<p style="color:#4a5148">You\'re signed in as ' + escapeHtml(viewer) + '.</p>' : '') +
      '</div>'
    ).setTitle('Lagom waitlist');
  }
  return HtmlService.createHtmlOutput(ADMIN_HTML)
    .setTitle('Lagom waitlist')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Called from the admin page. */
function getWaitlist() {
  requireViewer();
  const sheet = logSheet();
  const values = sheet.getDataRange().getValues();
  const head = values.shift();
  const col = (h) => head.indexOf(h);
  const iso = (v) => (v instanceof Date ? v.toISOString() : String(v || ''));
  return {
    models: MODELS,
    sheetUrl: sheet.getParent().getUrl(),
    signups: values.filter((r) => r[col('ID')]).map((r) => ({
      submitted: iso(r[col('Submitted')]),
      name: String(r[col('Name')]),
      email: String(r[col('Email')]),
      street: String(r[col('Street')]),
      city: String(r[col('City')]),
      state: String(r[col('State')]),
      zip: String(r[col('ZIP')]),
      model: String(r[col('Model')]),
    })).reverse(),
  };
}

/* ── Setup ──────────────────────────────────────────────────────────────── */

/** Run once from the Apps Script editor: grants permissions and creates the waitlist sheet. */
function setup() {
  console.log('Waitlist sheet: ' + logSheet().getParent().getUrl());
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function logSheet() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('LOG_SHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id).getSheets()[0]; } catch (e) { /* log deleted — make a new one */ }
  }
  const ss = SpreadsheetApp.create(LOG_NAME);
  const sheet = ss.getSheets()[0];
  sheet.setName('Waitlist');
  sheet.appendRow(LOG_HEADERS);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, LOG_HEADERS.length).setFontWeight('bold');
  sheet.getRange('H:H').setNumberFormat('@'); // keep leading zeros in ZIP codes
  props.setProperty('LOG_SHEET_ID', ss.getId());
  return sheet;
}

function currentUser() {
  return String(Session.getActiveUser().getEmail() || '').toLowerCase();
}

function canView(email) {
  return !!email && email.endsWith('@' + ADMIN_DOMAIN.toLowerCase());
}

function requireViewer() {
  if (!canView(currentUser())) throw new Error('You don\'t have access to the waitlist.');
}

function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function clean(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

/** Stop signup text such as "=HYPERLINK(...)" being run as a spreadsheet formula. */
function safeCell(value) {
  const s = String(value == null ? '' : value);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ── Admin page markup ──────────────────────────────────────────────────── */
// Kept in this file so the whole waitlist is a single paste. The page's script
// puts every value on the page with textContent, never innerHTML.

const ADMIN_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --green: #3cb371; --green-dark: #2a8f57; --green-deep: #1a5c38; --green-pale: #e8f5ee;
    --cream: #f9f6f0; --white: #fdfcfa; --charcoal: #1e2420; --stone: #4a5148; --mist: #8a9488;
    --line: rgba(30, 36, 32, 0.12);
    --serif: 'Cormorant Garamond', Georgia, serif; --sans: 'DM Sans', system-ui, sans-serif;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--cream); color: var(--charcoal); font: 15px/1.5 var(--sans); }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 32px max(16px, 3vw) 64px; display: grid; gap: 20px; }
  header { display: flex; flex-wrap: wrap; gap: 12px 24px; align-items: flex-end; justify-content: space-between; }
  h1 { margin: 0; font: 600 2.2rem/1.1 var(--serif); letter-spacing: -0.01em; }
  h2 { margin: 0 0 12px; font-size: 0.8rem; font-weight: 500; color: var(--stone); text-transform: uppercase; letter-spacing: 0.06em; }
  .sub { margin: 4px 0 0; color: var(--stone); font-size: 0.9rem; }
  a { color: var(--green-dark); }
  .links { font-size: 0.85rem; }
  .card { background: var(--white); border: 1px solid var(--line); border-radius: 12px; padding: 18px 20px; }
  .card.flush { padding: 0; overflow: hidden; }
  .total { font: 600 3.4rem/1 var(--serif); }
  .total small { display: block; font: 400 0.85rem var(--sans); color: var(--stone); margin-top: 6px; }
  .panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr)); gap: 20px; }
  .bars { display: grid; gap: 6px; max-height: 360px; overflow-y: auto; }
  .bar { display: grid; grid-template-columns: 5.5rem 1fr 2.5rem; gap: 10px; align-items: center; font-size: 0.9rem;
         border: 0; background: none; padding: 2px 0; font-family: inherit; color: inherit; text-align: left; cursor: pointer; }
  .bar[aria-pressed="true"] .label { font-weight: 500; color: var(--green-deep); }
  .track { height: 10px; background: var(--green-pale); border-radius: 5px; overflow: hidden; }
  .fill { height: 100%; background: var(--green); border-radius: 5px; }
  .count { text-align: right; font-variant-numeric: tabular-nums; }
  .tools { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  input[type="search"], select { font: inherit; color: var(--charcoal); background: var(--white);
          border: 1px solid var(--line); border-radius: 4px; padding: 7px 10px; }
  input[type="search"] { flex: 1 1 16rem; min-width: 0; }
  button.plain { font: inherit; font-size: 0.85rem; background: none; border: 1px solid var(--line); border-radius: 4px;
          padding: 7px 12px; cursor: pointer; color: var(--stone); }
  :focus-visible { outline: 2px solid var(--green-dark); outline-offset: 2px; }
  .scroll { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th { text-align: left; font-weight: 500; color: var(--stone); font-size: 0.8rem; padding: 10px 12px;
       border-bottom: 1px solid var(--line); white-space: nowrap; }
  td { padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
  .name { font-weight: 500; }
  .nowrap { white-space: nowrap; }
  .muted { color: var(--mist); }
  .empty { padding: 40px 16px; text-align: center; color: var(--stone); }
  @media (max-width: 700px) { .hide-sm { display: none; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <h1>Waitlist</h1>
      <p class="sub" id="summary">Loading waitlist…</p>
    </div>
    <div class="links"><a id="sheetLink" href="#" target="_blank" rel="noopener" hidden>Open as spreadsheet</a></div>
  </header>

  <div class="panels">
    <div class="card"><div class="total" id="total">–<small>people on the waitlist</small></div></div>
    <div class="card"><h2>By model</h2><div class="bars" id="byModel"></div></div>
    <div class="card"><h2>By state</h2><div class="bars" id="byState"></div></div>
  </div>

  <div class="tools">
    <input type="search" id="search" placeholder="Search name, email, city, ZIP" aria-label="Search the waitlist">
    <button type="button" class="plain" id="clear" hidden>Clear filters</button>
    <button type="button" class="plain" id="refresh">Refresh</button>
  </div>

  <div class="card flush">
    <div class="scroll">
      <table>
        <thead><tr>
          <th>Signed up</th><th>Name</th><th class="hide-sm">Email</th><th>Address</th><th>State</th><th>Model</th>
        </tr></thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
    <div class="empty" id="empty" hidden></div>
  </div>
</div>

<script>
  var state = { list: [], models: [], fState: '', fModel: '' };
  var el = function (id) { return document.getElementById(id); };
  var dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  function make(tag, props, children) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      if (k === 'text') n.textContent = props[k];
      else if (k === 'className') n.className = props[k];
      else n.setAttribute(k, props[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  function load() {
    el('summary').textContent = 'Loading waitlist…';
    google.script.run
      .withSuccessHandler(function (data) {
        state.list = data.signups;
        state.models = data.models;
        el('sheetLink').href = data.sheetUrl; el('sheetLink').hidden = false;
        render();
      })
      .withFailureHandler(function (err) {
        el('summary').textContent = 'Couldn\'t load the waitlist: ' + err.message;
      })
      .getWaitlist();
  }

  function tally(key) {
    var out = {};
    state.list.forEach(function (s) { out[s[key]] = (out[s[key]] || 0) + 1; });
    return out;
  }

  function bars(target, counts, order, selected, onPick) {
    var max = Math.max.apply(null, [1].concat(order.map(function (k) { return counts[k] || 0; })));
    target.replaceChildren.apply(target, order.map(function (k) {
      var n = counts[k] || 0;
      var b = make('button', { type: 'button', className: 'bar', 'aria-pressed': String(selected === k),
        'aria-label': k + ': ' + n }, [
        make('span', { className: 'label', text: k }),
        make('span', { className: 'track' }, [make('span', { className: 'fill', style: 'display:block;width:' + (n / max * 100) + '%' })]),
        make('span', { className: 'count', text: String(n) }),
      ]);
      b.addEventListener('click', function () { onPick(selected === k ? '' : k); });
      return b;
    }));
  }

  function visible() {
    var q = el('search').value.trim().toLowerCase();
    return state.list.filter(function (s) {
      if (state.fState && s.state !== state.fState) return false;
      if (state.fModel && s.model !== state.fModel) return false;
      if (!q) return true;
      return [s.name, s.email, s.street, s.city, s.zip].join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }

  function render() {
    var n = state.list.length;
    el('total').firstChild.textContent = String(n);
    el('summary').textContent = n ? 'Click a model or state to filter the list.' : 'No signups yet.';
    var byModel = tally('model'), byState = tally('state');
    var states = Object.keys(byState).sort(function (a, b) { return byState[b] - byState[a] || a.localeCompare(b); });
    bars(el('byModel'), byModel, state.models, state.fModel, function (k) { state.fModel = k; render(); });
    bars(el('byState'), byState, states, state.fState, function (k) { state.fState = k; render(); });
    if (!states.length) el('byState').appendChild(make('span', { className: 'muted', text: 'No signups yet.' }));
    el('clear').hidden = !(state.fState || state.fModel);

    var list = visible();
    var body = el('rows');
    body.replaceChildren();
    list.forEach(function (s) {
      var email = make('a', { href: 'mailto:' + s.email, text: s.email });
      body.appendChild(make('tr', {}, [
        make('td', { className: 'nowrap', text: s.submitted ? dateFmt.format(new Date(s.submitted)) : '—' }),
        make('td', { className: 'name', text: s.name }),
        make('td', { className: 'hide-sm' }, [email]),
        make('td', { text: s.street + ', ' + s.city + ' ' + s.zip }),
        make('td', { text: s.state }),
        make('td', { className: 'nowrap', text: s.model }),
      ]));
    });
    el('empty').hidden = list.length > 0;
    el('empty').textContent = n ? 'No one matches these filters.' : 'Signups appear here as soon as someone joins the waitlist.';
  }

  el('search').addEventListener('input', render);
  el('clear').addEventListener('click', function () { state.fState = ''; state.fModel = ''; render(); });
  el('refresh').addEventListener('click', load);
  load();
</script>
</body>
</html>`;
