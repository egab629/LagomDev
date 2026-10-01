# Careers page — managing your job sheet

The Careers page (`#page-careers` in `index.html`) renders job cards live from a
Google Sheet. No backend, no build step — the sheet is the database.

**This is already set up and live.** The sheet is:
[Lagom Development — Job Openings](https://docs.google.com/spreadsheets/d/15nF3Y18O_J4vJNMJUYiYLqAVuPUr1UAUkFG9MaYHvXI/edit)
(owned by gina@lagomdevelopment.com), it's published to the web as CSV, and
`script.js` already points `JOBS_SHEET_CSV_URL` at it. To manage postings, just
edit that sheet directly — add a row to post a role, set **Active** to `FALSE`
or delete the row to close one. Changes appear on the site within a few
minutes (Google's publish-to-web cache refreshes periodically; edit the sheet
again or wait a few minutes if a change doesn't show up immediately).

The rest of this doc is reference material — the column schema, and how to
reconnect a new sheet if you ever need to.

## 1. Sheet schema

One tab for jobs. Header row (any order, case-insensitive):

| Title | Department | Location | Type | Posted | Active | Description | Apply Link |
|---|---|---|---|---|---|---|---|
| Land Acquisition Manager | Development | Athens, GA | Full-time | 2026-09-15 | TRUE | Short 1-2 sentence summary of the role. | (optional) |

Notes:
- **Title** is the only required column — rows without one are skipped.
- **Active**: `TRUE`/`FALSE`, `Yes`/`No`, or `Open`/`Closed` all work. Leave the
  column out entirely and every row is treated as open.
- **Posted** should be a sortable date (`YYYY-MM-DD`); newest shows first.
- **Apply Link**: leave blank and the Apply button opens an on-page application
  form instead (see below). Fill it in to link to an external application form
  (e.g. an ATS) instead — opens in a new tab.
- Column headers are matched loosely — "Job Title", "Team", "City", "Employment
  Type", "Date Posted", "Status", "Summary", "Apply URL" all work too. See the
  `JOB_FIELD_ALIASES` map in `script.js` if you want to add more aliases.

To close a role, either set **Active** to `FALSE`/delete the row, or just delete
the row — no redeploy needed either way.

## 2. Reconnecting a different sheet

If you ever replace the sheet (new file, different tab), either:

- **Publish to web**: File → Share → Publish to web → select the Jobs tab →
  Comma-separated values (.csv) → Publish, then use the generated
  `https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?...output=csv` URL, or
- **Plain export link** (what's wired up now, simpler to read off the URL bar):
  as long as sharing is set to "Anyone with the link can view", use
  `https://docs.google.com/spreadsheets/d/<FILE_ID>/export?format=csv&gid=<TAB_GID>`
  — the file ID is in the sheet's URL, and the tab's `gid` is the number after
  `gid=` in the URL when that tab is active.

Either way, both are public, read-only CSV endpoints — anyone with the link can
view listed jobs, but not edit the sheet. Paste the new URL into `script.js`:

```js
const JOBS_SHEET_CSV_URL = '...';
```

Until this is set, the page shows three sample roles (`JOBS_DEMO_DATA` in
`script.js`) so it never looks broken.

## 3. How applications are delivered

The Apply button opens an on-page modal form (name, email, phone, resume link,
message) that submits via [Web3Forms](https://web3forms.com/) — no mail client
required on the applicant's end, unlike a `mailto:` link, which silently does
nothing if their computer has no default email app configured.

- Submissions email straight to **via@lagomdevelopment.com**, with a subject
  line naming the role ("Website Application: <role>").
- The access key lives in `index.html` as a hidden input
  (`name="access_key"`) inside the `#applyForm` element. It's safe to be
  public — it only allows sending *to* the registered email, nothing else.
- To change which inbox receives applications, get a new key for the new
  address at web3forms.com and swap that hidden input's value.
- If Web3Forms is ever unreachable, the form shows an inline error with a
  direct mailto fallback rather than failing silently.

## Why not Airtable?

Airtable's API requires a personal access token on every request. Calling it
directly from this page would mean shipping that token in public page source —
anyone could read it from view-source and use it against your base. Doing
Airtable safely needs a small serverless proxy (e.g. a Cloudflare Worker or
Vercel function) to hide the token server-side. Google Sheets' "publish to
web" CSV is public-by-design and read-only, so it's safe to call directly from
the browser with no extra infrastructure. If you'd rather use Airtable anyway,
say so and I can build the proxy function.
