/**
 * Lagom careers — application inbox (Google Apps Script web app).
 *
 * POST (from the careers-page form): saves the resume to a Drive folder, logs
 * the application to a Google Sheet and emails it to NOTIFY_EMAIL.
 * GET (opened in a browser): the private admin page for reviewing
 * applications, shown only to ADMIN_EMAILS.
 * See CAREERS-SETUP.md ("How applications are delivered") for deployment steps.
 */

const NOTIFY_EMAIL = 'pete@lagomdevelopment.com';
const ADMIN_EMAILS = ['gina@lagomdevelopment.com', 'pete@lagomdevelopment.com'];
const FOLDER_NAME = 'Website Job Applications';
const LOG_NAME = 'Website Job Applications log';
const STATUSES = ['New', 'Reviewing', 'Interview', 'Offer', 'Hired', 'Not a fit'];
const LOG_HEADERS = ['ID', 'Submitted', 'Position', 'Name', 'Email', 'Phone', 'Message',
  'Resume', 'Resume file ID', 'Status', 'Notes', 'Updated'];
const MAX_BYTES = 5 * 1024 * 1024;
const RESUME_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/* ── Receiving applications ─────────────────────────────────────────────── */

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.botcheck) return json({ success: true }); // honeypot tripped — drop quietly

    const name = clean(body.name, 200);
    const email = clean(body.email, 200);
    const phone = clean(body.phone, 50);
    const message = clean(body.message, 5000);
    const position = clean(body.position, 200) || 'General Interest';
    if (!name) throw new Error('Please enter your name.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Please enter a valid email address.');

    const resume = body.resume || {};
    const ext = String(resume.name || '').split('.').pop().toLowerCase();
    if (!RESUME_TYPES[ext] || !resume.data) throw new Error('Please attach your resume as a PDF or Word document.');
    const bytes = Utilities.base64Decode(resume.data);
    if (bytes.length > MAX_BYTES) throw new Error('Your resume is larger than 5 MB. Please attach a smaller file.');

    const submitted = new Date();
    const stamp = Utilities.formatDate(submitted, 'America/New_York', 'yyyy-MM-dd HHmm');
    const fileName = `${stamp} - ${position} - ${name}.${ext}`.replace(/[\\/:*?"<>|]/g, '-');
    const blob = Utilities.newBlob(bytes, RESUME_TYPES[ext], fileName);
    const file = applicationsFolder().createFile(blob);

    withLock(() => logSheet().appendRow([
      Utilities.getUuid(), submitted, safeCell(position), safeCell(name), safeCell(email),
      safeCell(phone), safeCell(message), file.getUrl(), file.getId(), 'New', '', submitted,
    ]));

    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      replyTo: email,
      subject: 'Website Application: ' + position,
      body: [
        `Position: ${position}`,
        `Name: ${name}`,
        `Email: ${email}`,
        `Phone: ${phone || '—'}`,
        '',
        'Message:',
        message || '—',
        '',
        `Resume (attached, also saved in Drive): ${file.getUrl()}`,
      ].join('\n'),
      attachments: [blob],
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
  if (!isAdmin(viewer)) {
    return HtmlService.createHtmlOutput(
      '<div style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#1e2420">' +
      '<h2 style="font-weight:600">You don\'t have access to this page</h2>' +
      '<p>Lagom job applications can only be viewed by ' + ADMIN_EMAILS.join(' and ') +
      ', signed in to Google.</p>' +
      (viewer ? '<p style="color:#4a5148">You\'re signed in as ' + escapeHtml(viewer) + '.</p>' : '') +
      '</div>'
    ).setTitle('Lagom applications');
  }
  return HtmlService.createHtmlOutput(ADMIN_HTML)
    .setTitle('Lagom applications')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Called from the admin page. */
function getApplications() {
  requireAdmin();
  const sheet = logSheet();
  const values = sheet.getDataRange().getValues();
  const head = values.shift();
  const col = (h) => head.indexOf(h);
  const iso = (v) => (v instanceof Date ? v.toISOString() : String(v || ''));
  return {
    statuses: STATUSES,
    folderUrl: applicationsFolder().getUrl(),
    sheetUrl: sheet.getParent().getUrl(),
    applications: values.filter((r) => r[col('ID')]).map((r) => ({
      id: String(r[col('ID')]),
      submitted: iso(r[col('Submitted')]),
      position: String(r[col('Position')]),
      name: String(r[col('Name')]),
      email: String(r[col('Email')]),
      phone: String(r[col('Phone')]),
      message: String(r[col('Message')]),
      resumeUrl: String(r[col('Resume')]),
      status: String(r[col('Status')] || 'New'),
      notes: String(r[col('Notes')]),
      updated: iso(r[col('Updated')]),
    })).reverse(),
  };
}

/** Called from the admin page: change an application's status and/or notes. */
function updateApplication(id, changes) {
  requireAdmin();
  return withLock(() => {
    const sheet = logSheet();
    const values = sheet.getDataRange().getValues();
    const head = values[0];
    const rowIndex = values.findIndex((r, i) => i > 0 && String(r[0]) === String(id));
    if (rowIndex < 1) throw new Error('That application could not be found. Reload the page.');
    const row = rowIndex + 1;
    if (changes.status !== undefined) {
      if (!STATUSES.includes(changes.status)) throw new Error('Unknown status.');
      sheet.getRange(row, head.indexOf('Status') + 1).setValue(changes.status);
    }
    if (changes.notes !== undefined) {
      sheet.getRange(row, head.indexOf('Notes') + 1).setValue(safeCell(clean(changes.notes, 5000)));
    }
    sheet.getRange(row, head.indexOf('Updated') + 1).setValue(new Date());
    return { ok: true };
  });
}

/* ── Setup ──────────────────────────────────────────────────────────────── */

/**
 * Run from the Apps Script editor after pasting a new version: grants
 * permissions, creates the folder and log, shares the folder with the other
 * admins so they can open resumes, and logs any resumes saved before the log existed.
 */
function setup() {
  const folder = applicationsFolder();
  const sheet = logSheet();
  const owner = Session.getEffectiveUser().getEmail().toLowerCase();
  const others = ADMIN_EMAILS.filter((e) => e.toLowerCase() !== owner);
  if (others.length) folder.addViewers(others);

  const known = new Set(sheet.getDataRange().getValues().map((r) => String(r[8])));
  const files = folder.getFiles();
  let added = 0;
  while (files.hasNext()) {
    const f = files.next();
    if (f.getId() === sheet.getParent().getId() || known.has(f.getId())) continue;
    const parts = f.getName().replace(/\.[^.]+$/, '').split(' - ');
    sheet.appendRow([Utilities.getUuid(), f.getDateCreated(), safeCell(parts[1] || ''),
      safeCell(parts.slice(2).join(' - ') || f.getName()), '', '', '', f.getUrl(), f.getId(),
      'New', 'Added from the Drive folder (no contact details logged).', new Date()]);
    added += 1;
  }
  console.log('Resumes folder: ' + folder.getUrl());
  console.log('Applications log: ' + sheet.getParent().getUrl());
  console.log('Shared resumes folder with: ' + (others.join(', ') || 'nobody else'));
  console.log('Older resumes added to the log: ' + added);
  console.log('Emails left today: ' + MailApp.getRemainingDailyQuota());
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function applicationsFolder() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* folder deleted — make a new one */ }
  }
  const folder = DriveApp.createFolder(FOLDER_NAME);
  props.setProperty('FOLDER_ID', folder.getId());
  return folder;
}

function logSheet() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('LOG_SHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id).getSheets()[0]; } catch (e) { /* log deleted — make a new one */ }
  }
  const ss = SpreadsheetApp.create(LOG_NAME);
  const sheet = ss.getSheets()[0];
  sheet.setName('Applications');
  sheet.appendRow(LOG_HEADERS);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, LOG_HEADERS.length).setFontWeight('bold');
  DriveApp.getFileById(ss.getId()).moveTo(applicationsFolder());
  props.setProperty('LOG_SHEET_ID', ss.getId());
  return sheet;
}

function currentUser() {
  return String(Session.getActiveUser().getEmail() || '').toLowerCase();
}

function isAdmin(email) {
  return !!email && ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email);
}

function requireAdmin() {
  if (!isAdmin(currentUser())) throw new Error('You don\'t have access to applications.');
}

function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function clean(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

/** Stop applicant text such as "=HYPERLINK(...)" being run as a spreadsheet formula. */
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
// Kept in this file so the whole inbox is a single paste. The page's script
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
    --line: rgba(30, 36, 32, 0.12); --bad: #b42318; --amber: #8a5a00; --amber-pale: #fdf3e1;
    --serif: 'Cormorant Garamond', Georgia, serif; --sans: 'DM Sans', system-ui, sans-serif;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--cream); color: var(--charcoal); font: 15px/1.5 var(--sans); }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 32px max(16px, 3vw) 64px; display: grid; gap: 20px; }
  header { display: flex; flex-wrap: wrap; gap: 12px 24px; align-items: flex-end; justify-content: space-between; }
  h1 { margin: 0; font: 600 2.2rem/1.1 var(--serif); letter-spacing: -0.01em; }
  .sub { margin: 4px 0 0; color: var(--stone); font-size: 0.9rem; }
  .links { display: flex; gap: 16px; font-size: 0.85rem; }
  a { color: var(--green-dark); }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { font: inherit; font-size: 0.85rem; border: 1px solid var(--line); background: var(--white); color: var(--stone);
          border-radius: 999px; padding: 4px 12px; cursor: pointer; }
  .chip b { font-weight: 500; color: var(--charcoal); margin-left: 4px; font-variant-numeric: tabular-nums; }
  .chip[aria-pressed="true"] { background: var(--green-deep); border-color: var(--green-deep); color: #fff; }
  .chip[aria-pressed="true"] b { color: #fff; }
  .tools { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  input[type="search"], select, textarea { font: inherit; color: var(--charcoal); background: var(--white);
          border: 1px solid var(--line); border-radius: 4px; padding: 7px 10px; }
  input[type="search"] { flex: 1 1 16rem; min-width: 0; }
  button.plain { font: inherit; font-size: 0.85rem; background: none; border: 1px solid var(--line); border-radius: 4px;
          padding: 7px 12px; cursor: pointer; color: var(--stone); }
  :focus-visible { outline: 2px solid var(--green-dark); outline-offset: 2px; }
  .card { background: var(--white); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
  .scroll { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th { text-align: left; font-weight: 500; color: var(--stone); font-size: 0.8rem; padding: 10px 12px;
       border-bottom: 1px solid var(--line); white-space: nowrap; }
  td { padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
  tr.app { cursor: pointer; }
  tr.app:hover td, tr.app.open td { background: var(--green-pale); }
  tr.app.open td { border-bottom-color: transparent; }
  .name { font-weight: 500; }
  .muted { color: var(--mist); }
  .nowrap { white-space: nowrap; }
  .status { font-size: 0.85rem; padding: 4px 6px; }
  .s-New { border-color: var(--green); background: var(--green-pale); color: var(--green-deep); }
  .s-Interview, .s-Offer { border-color: #d9a441; background: var(--amber-pale); color: var(--amber); }
  .s-Hired { border-color: var(--green-deep); background: var(--green-deep); color: #fff; }
  .s-Not-a-fit { color: var(--mist); }
  tr.detail td { background: var(--green-pale); padding: 4px 12px 18px; }
  .detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr)); gap: 16px; }
  .label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--stone); margin-bottom: 4px; }
  .message { white-space: pre-wrap; margin: 0; }
  textarea { width: 100%; min-height: 96px; resize: vertical; }
  .row-actions { display: flex; gap: 10px; align-items: center; margin-top: 8px; font-size: 0.85rem; }
  .btn { font: inherit; font-size: 0.85rem; background: var(--green-dark); color: #fff; border: 0; border-radius: 4px;
         padding: 7px 14px; cursor: pointer; }
  .btn:disabled { opacity: 0.6; cursor: default; }
  .empty { padding: 40px 16px; text-align: center; color: var(--stone); }
  .toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); background: var(--charcoal); color: #fff;
           padding: 8px 16px; border-radius: 6px; font-size: 0.85rem; opacity: 0; transition: opacity 0.2s; pointer-events: none; }
  .toast.show { opacity: 1; }
  .toast.error { background: var(--bad); }
  @media (max-width: 700px) { .hide-sm { display: none; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <h1>Job applications</h1>
      <p class="sub" id="summary">Loading applications…</p>
    </div>
    <div class="links">
      <a id="folderLink" href="#" target="_blank" rel="noopener" hidden>Resumes folder</a>
      <a id="sheetLink" href="#" target="_blank" rel="noopener" hidden>Open as spreadsheet</a>
    </div>
  </header>

  <div class="chips" id="chips" role="group" aria-label="Filter by status"></div>

  <div class="tools">
    <input type="search" id="search" placeholder="Search name, email, role, notes" aria-label="Search applications">
    <select id="role" aria-label="Filter by role"><option value="">All roles</option></select>
    <button type="button" class="plain" id="refresh">Refresh</button>
  </div>

  <div class="card">
    <div class="scroll">
      <table>
        <thead><tr>
          <th>Submitted</th><th>Name</th><th>Role</th><th class="hide-sm">Email</th><th class="hide-sm">Phone</th>
          <th>Resume</th><th>Status</th>
        </tr></thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
    <div class="empty" id="empty" hidden></div>
  </div>
</div>
<div class="toast" id="toast" role="status"></div>

<script>
  var state = { apps: [], statuses: [], filter: 'Active', open: null };
  var el = function (id) { return document.getElementById(id); };
  var dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

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

  function toast(msg, isError) {
    var t = el('toast');
    t.textContent = msg;
    t.className = 'toast show' + (isError ? ' error' : '');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.className = 'toast'; }, isError ? 5000 : 2000);
  }

  function statusClass(s) { return 'status s-' + s.replace(/\s+/g, '-'); }
  function stop(e) { e.stopPropagation(); }

  function load() {
    el('summary').textContent = 'Loading applications…';
    google.script.run
      .withSuccessHandler(function (data) {
        state.apps = data.applications;
        state.statuses = data.statuses;
        el('folderLink').href = data.folderUrl; el('folderLink').hidden = false;
        el('sheetLink').href = data.sheetUrl; el('sheetLink').hidden = false;
        var roles = Array.from(new Set(state.apps.map(function (a) { return a.position; }))).filter(Boolean).sort();
        var current = el('role').value;
        el('role').replaceChildren(make('option', { value: '', text: 'All roles' }));
        roles.forEach(function (r) { el('role').appendChild(make('option', { value: r, text: r })); });
        el('role').value = roles.indexOf(current) >= 0 ? current : '';
        render();
      })
      .withFailureHandler(function (err) {
        el('summary').textContent = 'Couldn\'t load applications: ' + err.message;
      })
      .getApplications();
  }

  function isClosed(a) { return a.status === 'Hired' || a.status === 'Not a fit'; }

  function visible() {
    var q = el('search').value.trim().toLowerCase();
    var role = el('role').value;
    return state.apps.filter(function (a) {
      if (state.filter === 'Active' && isClosed(a)) return false;
      if (state.filter !== 'Active' && state.filter !== 'All' && a.status !== state.filter) return false;
      if (role && a.position !== role) return false;
      if (!q) return true;
      return [a.name, a.email, a.position, a.notes, a.message, a.phone].join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }

  function renderChips() {
    var counts = { All: state.apps.length, Active: 0 };
    state.apps.forEach(function (a) {
      counts[a.status] = (counts[a.status] || 0) + 1;
      if (!isClosed(a)) counts.Active += 1;
    });
    var names = ['Active', 'All'].concat(state.statuses);
    el('chips').replaceChildren.apply(el('chips'), names.map(function (s) {
      var b = make('button', { type: 'button', className: 'chip', 'aria-pressed': String(state.filter === s) },
        [document.createTextNode(s === 'Active' ? 'Open' : s), make('b', { text: String(counts[s] || 0) })]);
      b.addEventListener('click', function () { state.filter = s; render(); });
      return b;
    }));
    var fresh = counts.New || 0;
    el('summary').textContent = state.apps.length + ' application' + (state.apps.length === 1 ? '' : 's') +
      (fresh ? ', ' + fresh + ' new' : '') + '. Select a row to see the message and add notes.';
  }

  function render() {
    renderChips();
    var list = visible();
    var body = el('rows');
    body.replaceChildren();
    list.forEach(function (a) {
      var open = state.open === a.id;
      var resume = a.resumeUrl
        ? make('a', { href: a.resumeUrl, target: '_blank', rel: 'noopener', text: 'Open' })
        : make('span', { className: 'muted', text: '—' });
      resume.addEventListener('click', stop);
      var email = a.email ? make('a', { href: 'mailto:' + a.email, text: a.email }) : make('span', { className: 'muted', text: '—' });
      email.addEventListener('click', stop);
      var select = make('select', { className: statusClass(a.status), 'aria-label': 'Status for ' + a.name });
      state.statuses.forEach(function (s) { select.appendChild(make('option', { value: s, text: s })); });
      select.value = a.status;
      select.addEventListener('click', stop);
      select.addEventListener('keydown', stop);
      select.addEventListener('change', function () { save(a, { status: select.value }, select); });
      var tr = make('tr', { className: 'app' + (open ? ' open' : ''), tabindex: '0', 'aria-expanded': String(open) }, [
        make('td', { className: 'nowrap', text: a.submitted ? dateFmt.format(new Date(a.submitted)) : '—' }),
        make('td', { className: 'name', text: a.name }),
        make('td', { text: a.position || '—' }),
        make('td', { className: 'hide-sm' }, [email]),
        make('td', { className: 'hide-sm nowrap', text: a.phone || '—' }),
        make('td', {}, [resume]),
        make('td', {}, [select]),
      ]);
      var toggle = function () { state.open = open ? null : a.id; render(); };
      tr.addEventListener('click', toggle);
      tr.addEventListener('keydown', function (e) {
        if (e.target === tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(); }
      });
      body.appendChild(tr);
      if (open) body.appendChild(detailRow(a));
    });
    var empty = el('empty');
    empty.hidden = list.length > 0;
    empty.textContent = state.apps.length ? 'No applications match these filters.'
      : 'No applications yet. They appear here as soon as someone applies on the careers page.';
  }

  function detailRow(a) {
    var notes = make('textarea', { 'aria-label': 'Notes for ' + a.name, placeholder: 'Add notes for the team' });
    notes.value = a.notes;
    var btn = make('button', { type: 'button', className: 'btn', text: 'Save notes' });
    var meta = make('span', { className: 'muted', text: a.updated ? 'Last updated ' + dateFmt.format(new Date(a.updated)) : '' });
    btn.addEventListener('click', function () { save(a, { notes: notes.value }, btn); });
    var contact = make('div', {}, [
      make('div', { className: 'label', text: 'Contact' }),
      make('div', { text: (a.email || 'No email logged') + (a.phone ? ' · ' + a.phone : '') }),
      make('div', { className: 'label', text: 'Message', style: 'margin-top:12px' }),
      make('p', { className: 'message', text: a.message || 'No message.' }),
    ]);
    var notesBox = make('div', {}, [
      make('div', { className: 'label', text: 'Team notes' }), notes,
      make('div', { className: 'row-actions' }, [btn, meta]),
    ]);
    return make('tr', { className: 'detail' },
      [make('td', { colspan: '7' }, [make('div', { className: 'detail-grid' }, [contact, notesBox])])]);
  }

  function save(a, changes, control) {
    control.disabled = true;
    google.script.run
      .withSuccessHandler(function () {
        Object.keys(changes).forEach(function (k) { a[k] = changes[k]; });
        a.updated = new Date().toISOString();
        toast(changes.status ? 'Status set to ' + changes.status : 'Notes saved');
        render();
      })
      .withFailureHandler(function (err) {
        toast('Couldn\'t save: ' + err.message, true);
        render();
      })
      .updateApplication(a.id, changes);
  }

  el('search').addEventListener('input', render);
  el('role').addEventListener('change', render);
  el('refresh').addEventListener('click', load);
  load();
</script>
</body>
</html>`;
