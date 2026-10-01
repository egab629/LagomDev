// Prevent browser scroll restoration on SPA
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.addEventListener('load', function() { window.scrollTo(0, 0); });

function toggleDropdown(el) {
  const item = el.closest('.has-dropdown');
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.has-dropdown').forEach(d => d.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
}

document.addEventListener('click', function(e) {
  if (!e.target.closest('.has-dropdown')) {
    document.querySelectorAll('.has-dropdown').forEach(d => d.classList.remove('open'));
  }
});

function showPage(id) {
  const target = document.getElementById('page-' + id);
  if (!target) return;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  target.classList.add('active');
  window.scrollTo(0, 0);
}

function toggleMenu() {
  const menu = document.getElementById('mobileMenu');
  menu.classList.toggle('open');
}

function toggleFaq(btn) {
  const item = btn.parentElement;
  const wasOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item').forEach(f => f.classList.remove('open'));
  if (!wasOpen) item.classList.add('open');
}


function submitSalesForm() {
  const name = document.getElementById('cs-name').value.trim();
  const email = document.getElementById('cs-email').value.trim();
  if (!name || !email) { alert('Please fill in your name and email.'); return; }
  const phone = document.getElementById('cs-phone').value.trim();
  const interest = document.getElementById('cs-interest').value;
  const message = document.getElementById('cs-message').value.trim();
  const subject = encodeURIComponent('Sales Inquiry — ' + name);
  const body = encodeURIComponent(
    'Name: ' + name + '\n' +
    'Email: ' + email + '\n' +
    (phone ? 'Phone: ' + phone + '\n' : '') +
    (interest ? 'Interest: ' + interest + '\n' : '') +
    (message ? '\nMessage:\n' + message : '')
  );
  window.location.href = 'mailto:gabby@lagomdevelopment.com?subject=' + subject + '&body=' + body;
  document.getElementById('cs-form-success').style.display = 'block';
  document.getElementById('cs-name').value = '';
  document.getElementById('cs-email').value = '';
  document.getElementById('cs-phone').value = '';
  document.getElementById('cs-interest').value = '';
  document.getElementById('cs-message').value = '';
}

function submitForm() {
  const name = document.getElementById('cf-name').value.trim();
  const email = document.getElementById('cf-email').value.trim();
  if (!name || !email) { alert('Please fill in your name and email.'); return; }
  document.getElementById('form-success').style.display = 'block';
  document.getElementById('cf-name').value = '';
  document.getElementById('cf-email').value = '';
  document.getElementById('cf-phone').value = '';
  document.getElementById('cf-message').value = '';
}

/* ═══════════════════════════════════════
   CAREERS — dynamic job board
   Jobs are pulled from a Google Sheet published to the web as CSV.
   See CAREERS-SETUP.md for how to connect your own sheet.
═══════════════════════════════════════ */

// Public, read-only CSV export of the "Lagom Development — Job Openings" Google Sheet.
// Edit roles at: https://docs.google.com/spreadsheets/d/15nF3Y18O_J4vJNMJUYiYLqAVuPUr1UAUkFG9MaYHvXI/edit
const JOBS_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/15nF3Y18O_J4vJNMJUYiYLqAVuPUr1UAUkFG9MaYHvXI/export?format=csv&gid=1825212422';

// Shown until a real sheet is connected, so the page never looks broken.
const JOBS_DEMO_DATA = [
  { title: 'Land Acquisition Manager', department: 'Development', location: 'Athens, GA', type: 'Full-time', posted: '2026-09-15', active: true,
    description: 'Identify, underwrite, and help close acquisitions for new Lagom communities across the Southeast.', applyLink: '' },
  { title: 'Construction Site Superintendent', department: 'Construction', location: 'Athens, GA', type: 'Full-time', posted: '2026-09-10', active: true,
    description: 'Run day-to-day operations at Bluebird Lane, coordinating SIPs crews, subcontractors, and inspections.', applyLink: '' },
  { title: 'Marketing & Community Coordinator', department: 'Marketing', location: 'Remote (Southeast US)', type: 'Full-time', posted: '2026-09-02', active: true,
    description: 'Own our homebuyer-facing content, social channels, and on-the-ground community events.', applyLink: '' }
];

let jobsState = { all: [], loaded: false, error: false };

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// Minimal RFC4180 CSV parser — handles quoted fields, embedded commas/newlines, "" escapes.
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip, \n handles the break */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(cell => cell.trim() !== ''));
}

const JOB_FIELD_ALIASES = {
  title: ['title', 'job title', 'position', 'role'],
  department: ['department', 'team', 'dept'],
  location: ['location', 'city', 'office'],
  type: ['type', 'employment type', 'job type'],
  posted: ['posted', 'date posted', 'posted date', 'date'],
  active: ['active', 'status', 'open'],
  description: ['description', 'summary', 'details', 'about the role'],
  applyLink: ['apply link', 'apply url', 'application link', 'url', 'link']
};

function matchHeader(header) {
  const h = header.trim().toLowerCase();
  for (const key in JOB_FIELD_ALIASES) {
    if (JOB_FIELD_ALIASES[key].includes(h)) return key;
  }
  return null;
}

function parseActive(value) {
  if (value === undefined || value === '') return true; // no column → assume open
  const v = String(value).trim().toLowerCase();
  return ['true', 'yes', 'y', 'open', 'active', '1', 'published'].includes(v);
}

function rowsToJobs(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map(matchHeader);
  return rows.slice(1).map(cells => {
    const job = {};
    headers.forEach((key, i) => { if (key) job[key] = (cells[i] || '').trim(); });
    job.active = parseActive(job.active);
    return job;
  }).filter(j => j.title && j.active);
}

async function fetchJobs() {
  if (!JOBS_SHEET_CSV_URL || JOBS_SHEET_CSV_URL === 'PASTE_YOUR_PUBLISHED_CSV_URL_HERE') {
    jobsState = { all: JOBS_DEMO_DATA.filter(j => j.active), loaded: true, error: false };
    renderJobs();
    return;
  }
  try {
    const res = await fetch(JOBS_SHEET_CSV_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('Sheet fetch failed: ' + res.status);
    const text = await res.text();
    const jobs = rowsToJobs(parseCSV(text));
    jobs.sort((a, b) => new Date(b.posted || 0) - new Date(a.posted || 0));
    jobsState = { all: jobs, loaded: true, error: false };
  } catch (err) {
    console.error('[careers] failed to load jobs sheet:', err);
    jobsState = { all: JOBS_DEMO_DATA.filter(j => j.active), loaded: true, error: true };
  }
  populateJobFilters();
  renderJobs();
}

function populateJobFilters() {
  const deptSel = document.getElementById('job-filter-dept');
  const locSel = document.getElementById('job-filter-loc');
  if (!deptSel || !locSel) return;
  const depts = [...new Set(jobsState.all.map(j => j.department).filter(Boolean))].sort();
  const locs = [...new Set(jobsState.all.map(j => j.location).filter(Boolean))].sort();
  const keepValue = (sel, options, placeholder) => {
    const current = sel.value;
    sel.innerHTML = '<option value="">' + placeholder + '</option>' +
      options.map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('');
    if (options.includes(current)) sel.value = current;
  };
  keepValue(deptSel, depts, 'All departments');
  keepValue(locSel, locs, 'All locations');
}

function renderJobs() {
  const list = document.getElementById('job-list');
  if (!list) return;
  if (!jobsState.loaded) {
    list.innerHTML = '<div class="job-loading" id="job-loading">Loading open positions…</div>';
    return;
  }

  const dept = (document.getElementById('job-filter-dept') || {}).value || '';
  const loc = (document.getElementById('job-filter-loc') || {}).value || '';
  const q = ((document.getElementById('job-filter-q') || {}).value || '').trim().toLowerCase();

  const filtered = jobsState.all.filter(j => {
    if (dept && j.department !== dept) return false;
    if (loc && j.location !== loc) return false;
    if (q && !(j.title + ' ' + (j.description || '')).toLowerCase().includes(q)) return false;
    return true;
  });

  if (!filtered.length) {
    list.innerHTML = `
      <div class="job-empty">
        <h3>No open positions match right now</h3>
        <p>Try clearing filters, or send us your resume using the button below — we're growing fast.</p>
      </div>`;
    return;
  }

  list.innerHTML = filtered.map(job => `
    <div class="job-card">
      <div class="job-card-main">
        <h3>${escapeHtml(job.title)}</h3>
        <div class="job-meta">
          ${job.department ? `<span class="job-tag">${escapeHtml(job.department)}</span>` : ''}
          ${job.location ? `<span class="job-tag loc">${escapeHtml(job.location)}</span>` : ''}
          ${job.type ? `<span class="job-tag loc">${escapeHtml(job.type)}</span>` : ''}
        </div>
        ${job.description ? `<p class="job-desc">${escapeHtml(job.description)}</p>` : ''}
      </div>
      <div class="job-card-action">
        ${job.applyLink
          ? `<a class="btn btn-primary" href="${escapeHtml(job.applyLink)}" target="_blank" rel="noopener">Apply</a>`
          : `<button type="button" class="btn btn-primary apply-trigger" data-job-title="${escapeHtml(job.title)}">Apply</button>`}
      </div>
    </div>
  `).join('');
}

/* ═══════════════════════════════════════
   Application modal — submits via Web3Forms, no mail client required.
═══════════════════════════════════════ */

document.addEventListener('click', function(e) {
  const trigger = e.target.closest('.apply-trigger');
  if (trigger) openApplyModal(trigger.dataset.jobTitle);
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeApplyModal();
});

function openApplyModal(title) {
  const form = document.getElementById('applyForm');
  const backdrop = document.getElementById('applyModalBackdrop');
  if (!form || !backdrop) return;
  form.reset();
  form.style.display = '';
  document.getElementById('applyModalRole').textContent = title || 'this role';
  document.getElementById('applyPosition').value = title || 'General Interest';
  document.getElementById('applySubject').value = 'Website Application: ' + (title || 'General Interest');
  document.getElementById('apply-success').style.display = 'none';
  document.getElementById('apply-error').style.display = 'none';
  backdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeApplyModal() {
  const backdrop = document.getElementById('applyModalBackdrop');
  if (!backdrop) return;
  backdrop.classList.remove('open');
  document.body.style.overflow = '';
}

async function submitApplication(event) {
  event.preventDefault();
  const form = event.target;
  const btn = document.getElementById('apply-submit-btn');
  const successEl = document.getElementById('apply-success');
  const errorEl = document.getElementById('apply-error');
  successEl.style.display = 'none';
  errorEl.style.display = 'none';

  const formData = new FormData(form);
  if (formData.get('botcheck')) return; // honeypot tripped — silently drop

  btn.disabled = true;
  btn.textContent = 'Submitting…';

  try {
    const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(Object.fromEntries(formData.entries()))
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.message || 'Submission failed');
    form.style.display = 'none';
    successEl.style.display = 'block';
  } catch (err) {
    console.error('[careers] application submit failed:', err);
    errorEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Submit Application';
  }
}

document.addEventListener('DOMContentLoaded', fetchJobs);
