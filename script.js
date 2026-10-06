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
  // job-detail sets its own, more specific title in openJobDetail — leave it alone.
  if (id === 'careers') document.title = 'Careers — Lagom Development';
  else if (id !== 'job-detail') document.title = 'Lagom Development';
  // Every other page nav (About, FAQs, etc.) goes through plain showPage() with
  // no URL of its own — if we're leaving a /careers URL for one of those, drop
  // back to '/' so the address bar doesn't keep pointing at a job no longer shown.
  if (id !== 'careers' && id !== 'job-detail' && /^\/careers(\/|$)/.test(location.pathname)) {
    history.pushState({ page: 'home' }, '', '/');
  }
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
    description: 'Identify, underwrite, and help close acquisitions for new Lagom communities across the Southeast.', applyLink: '',
    positionOverview: 'Lagom Development is looking for a Land Acquisition Manager to source and close land deals that fuel our next communities across the Southeast. You will own the pipeline from first contact through closing.',
    companyOverview: 'Lagom Development is a vertically integrated housing company manufacturing our own high-performance SIPs and building walkable, attainable neighborhoods for working families across the Southeast.',
    partnerOverview: '',
    responsibilities: '- Identify and evaluate land acquisition opportunities across target Southeast markets\n- Underwrite deals, including pro formas and feasibility analysis\n- Negotiate purchase agreements and manage due diligence\n- Coordinate with legal, design, and entitlement teams through closing\n- Maintain relationships with brokers, landowners, and local municipalities',
    qualifications: '- 3+ years in land acquisition, development, or commercial real estate\n- Strong financial modeling and underwriting skills\n- Familiarity with entitlement and zoning processes in Georgia or the broader Southeast\n- Excellent negotiation and relationship-building skills',
    preferredSkills: '- Experience with SIPs or alternative construction methods\n- Comfort with Excel-based pro forma models and ArcGIS or similar mapping tools',
    portfolio: 'Please include a brief summary (1-2 deals) of land acquisitions you have sourced or closed, including deal size and outcome.',
    benefits: '- Competitive salary plus performance bonus\n- Health, dental, and vision insurance\n- Equity/profit-sharing eligibility\n- Direct influence on where and how Lagom grows next' },
  { title: 'Construction Site Superintendent', department: 'Construction', location: 'Athens, GA', type: 'Full-time', posted: '2026-09-10', active: true,
    description: 'Run day-to-day operations at Bluebird Lane, coordinating SIPs crews, subcontractors, and inspections.', applyLink: '',
    positionOverview: 'We are looking for a hands-on Site Superintendent to run daily operations at Bluebird Lane, our flagship SIPs-built community in Athens, GA.',
    companyOverview: 'Lagom Development is a vertically integrated housing company manufacturing our own high-performance SIPs and building walkable, attainable neighborhoods for working families across the Southeast.',
    partnerOverview: '',
    responsibilities: '- Run day-to-day field operations at Bluebird Lane\n- Coordinate SIPs installation crews and subcontractors\n- Schedule and pass municipal inspections\n- Enforce job site safety standards\n- Track progress against schedule and budget, flagging issues early',
    qualifications: '- 5+ years as a construction superintendent or site supervisor\n- Residential or light-commercial construction experience\n- Strong understanding of scheduling, safety, and inspection processes\n- Clear, proactive communicator',
    preferredSkills: '- Experience with SIPs or panelized construction\n- Familiarity with construction scheduling software (e.g. Procore, Buildertrend)',
    portfolio: '',
    benefits: '- Competitive salary\n- Health, dental, and vision insurance\n- Paid time off\n- Be the on-the-ground leader building Lagom\'s first community' },
  { title: 'Marketing & Community Coordinator', department: 'Marketing', location: 'Remote (Southeast US)', type: 'Full-time', posted: '2026-09-02', active: true,
    description: 'Own our homebuyer-facing content, social channels, and on-the-ground community events.', applyLink: '',
    positionOverview: 'Lagom is hiring a Marketing & Community Coordinator to own how prospective homebuyers and our broader community experience the Lagom story — online and in person.',
    companyOverview: 'Lagom Development is a vertically integrated housing company manufacturing our own high-performance SIPs and building walkable, attainable neighborhoods for working families across the Southeast.',
    partnerOverview: 'You will occasionally collaborate with Lagom\'s partners — including Sandy Creek LandCraft, SIPschool, and CrossCountry Mortgage — on co-marketed events and content.',
    responsibilities: '- Own homebuyer-facing content across the website, email, and social channels\n- Plan and run on-the-ground community events at Bluebird Lane\n- Coordinate with partners on co-marketed campaigns\n- Track and report on engagement and lead generation',
    qualifications: '- 2+ years in marketing, communications, or community management\n- Strong writing and content creation skills\n- Comfortable running in-person events\n- Self-directed and organized working remotely',
    preferredSkills: '- Experience with real estate or homebuilder marketing\n- Familiarity with email platforms, social scheduling tools, and basic design tools (Canva, Figma)',
    portfolio: 'Please share 2-3 writing or content samples (social posts, email campaigns, event recaps, etc.).',
    benefits: '- Competitive salary\n- Health, dental, and vision insurance\n- Remote-friendly with regular travel to Athens, GA\n- Ground-floor role shaping how Lagom shows up publicly' }
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
  applyLink: ['apply link', 'apply url', 'application link', 'url', 'link'],
  positionOverview: ['position overview', 'overview', 'role overview'],
  companyOverview: ['company overview', 'about lagom', 'about the company'],
  partnerOverview: ['partner overview', 'about the partner'],
  responsibilities: ['responsibilities', 'what you\'ll do', 'duties'],
  qualifications: ['qualifications', 'requirements', 'what you\'ll need'],
  preferredSkills: ['preferred technical skills', 'preferred skills', 'technical skills', 'nice to have'],
  portfolio: ['portfolio', 'portfolio requirements', 'work samples'],
  benefits: ['position benefits', 'benefits', 'perks']
};

function matchHeader(header) {
  const h = header.trim().toLowerCase();
  for (const key in JOB_FIELD_ALIASES) {
    if (JOB_FIELD_ALIASES[key].includes(h)) return key;
  }
  return null;
}

function slugify(str) {
  return String(str || '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'role';
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
  resolveRoute();
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
        <h3><a href="#" class="job-detail-trigger" data-slug="${escapeHtml(slugify(job.title))}">${escapeHtml(job.title)}</a></h3>
        <div class="job-meta">
          ${job.department ? `<span class="job-tag">${escapeHtml(job.department)}</span>` : ''}
          ${job.location ? `<span class="job-tag loc">${escapeHtml(job.location)}</span>` : ''}
          ${job.type ? `<span class="job-tag loc">${escapeHtml(job.type)}</span>` : ''}
        </div>
        ${job.description ? `<p class="job-desc">${escapeHtml(job.description)}</p>` : ''}
        <a href="#" class="job-detail-trigger job-detail-link" data-slug="${escapeHtml(slugify(job.title))}">View full details →</a>
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
   Job detail page — renders the full posting from the sheet's rich-text columns.
═══════════════════════════════════════ */

function renderRichText(text) {
  if (!text) return '';
  const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let html = '', inList = false;
  lines.forEach(line => {
    const isBullet = /^[-•*]\s+/.test(line);
    if (isBullet) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${escapeHtml(line.replace(/^[-•*]\s+/, ''))}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<p>${escapeHtml(line)}</p>`;
    }
  });
  if (inList) html += '</ul>';
  return html;
}

function renderDetailSection(heading, text) {
  if (!text) return '';
  return `<div class="job-detail-section"><h3>${escapeHtml(heading)}</h3>${renderRichText(text)}</div>`;
}

function openJobDetail(slug) {
  const job = jobsState.all.find(j => slugify(j.title) === slug);
  if (!job) {
    // Stale or mistyped link — land on the list instead, and fix the address bar to match.
    if (location.pathname.replace(/\/+$/, '') !== '/careers') {
      history.replaceState({ page: 'careers' }, '', '/careers');
    }
    showPage('careers');
    return;
  }

  document.title = job.title + ' — Careers — Lagom Development';
  document.getElementById('jobDetailTitle').textContent = job.title;
  document.getElementById('jobDetailMeta').innerHTML = [
    job.department ? `<span class="job-tag">${escapeHtml(job.department)}</span>` : '',
    job.location ? `<span class="job-tag loc">${escapeHtml(job.location)}</span>` : '',
    job.type ? `<span class="job-tag loc">${escapeHtml(job.type)}</span>` : ''
  ].join('');

  const sections = [
    ['Position Overview', job.positionOverview],
    ['Company Overview', job.companyOverview],
    ['Partner Overview', job.partnerOverview],
    ['Responsibilities', job.responsibilities],
    ['Qualifications', job.qualifications],
    ['Preferred Technical Skills', job.preferredSkills],
    ['Portfolio', job.portfolio],
    ['Position Benefits', job.benefits]
  ];
  const sectionsHtml = sections.map(([h, t]) => renderDetailSection(h, t)).join('');
  document.getElementById('jobDetailContent').innerHTML =
    sectionsHtml || (job.description ? `<p class="job-desc">${escapeHtml(job.description)}</p>` : '');

  const applyHtml = job.applyLink
    ? `<a class="btn btn-primary" href="${escapeHtml(job.applyLink)}" target="_blank" rel="noopener">Apply for this role</a>`
    : `<button type="button" class="btn btn-primary apply-trigger" data-job-title="${escapeHtml(job.title)}">Apply for this role</button>`;
  document.getElementById('jobDetailApplyAction').innerHTML = applyHtml;
  document.getElementById('jobDetailApplyActionBottom').innerHTML = applyHtml;

  showPage('job-detail');
}

/* ═══════════════════════════════════════
   Routing — /careers and /careers/<slug> get real, shareable URLs via the
   History API, with a Vercel rewrite (vercel.json) so a direct hit or a
   page refresh on those paths still serves this same index.html.
═══════════════════════════════════════ */

function navigateToCareers() {
  if (location.pathname.replace(/\/+$/, '') !== '/careers') {
    history.pushState({ page: 'careers' }, '', '/careers');
  }
  showPage('careers');
}

function navigateToJobDetail(slug) {
  const path = '/careers/' + slug;
  if (location.pathname.replace(/\/+$/, '') !== path) {
    history.pushState({ page: 'job', slug }, '', path);
  }
  openJobDetail(slug);
}

// Renders whatever the current URL points to — used on first load and on
// browser back/forward (popstate). Never touches history itself.
function resolveRoute() {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const jobMatch = path.match(/^\/careers\/([^/]+)$/);
  if (jobMatch) openJobDetail(decodeURIComponent(jobMatch[1]));
  else if (path === '/careers') showPage('careers');
  else if (path === '/') showPage('home');
}

window.addEventListener('popstate', resolveRoute);

document.addEventListener('click', function(e) {
  const detailTrigger = e.target.closest('.job-detail-trigger');
  if (detailTrigger) { e.preventDefault(); navigateToJobDetail(detailTrigger.dataset.slug); }
});

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
