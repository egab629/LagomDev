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

One tab for jobs. Header row (any order, case-insensitive). Columns A–H drive
the list cards on the Careers page; I–P drive the full detail page that opens
when someone clicks a role (title or "View full details →").

| Title | Department | Location | Type | Posted | Active | Description | Apply Link |
|---|---|---|---|---|---|---|---|
| Land Acquisition Manager | Development | Athens, GA | Full-time | 2026-09-15 | TRUE | Short 1-2 sentence summary of the role. | (optional) |

| Position Overview | Company Overview | Partner Overview | Responsibilities | Qualifications | Preferred Technical Skills | Portfolio | Position Benefits |
|---|---|---|---|---|---|---|---|
| Opening paragraph(s) for the full posting. | Boilerplate about Lagom. | Optional — only if a partner org is involved. | Bulleted list. | Bulleted list. | Bulleted list. | What to include/submit, if anything. | Bulleted list. |

Notes:
- **Title** is the only required column — rows without one are skipped.
- **Active**: `TRUE`/`FALSE`, `Yes`/`No`, or `Open`/`Closed` all work. Leave the
  column out entirely and every row is treated as open.
- **Salary** (optional, any column position): free text shown as a tag on the
  job card and detail page, e.g. `$55,000 – $70,000 / yr` or `$20 – $24 / hr`.
  Leave blank to hide it. "Salary Range", "Pay", "Pay Range" and
  "Compensation" also work as the header.
- **Posted** should be a sortable date (`YYYY-MM-DD`); newest shows first.
- **Description** (column G) is the short teaser shown on the list card. It's
  also what the detail page falls back to showing if none of the I–P columns
  are filled in yet.
- **Apply Link**: leave blank and the Apply button opens an on-page application
  form instead (see below). Fill it in to link to an external application form
  (e.g. an ATS) instead — opens in a new tab.
- Columns I–P (**Position Overview** through **Position Benefits**) are each
  optional — a section only appears on the detail page if its cell has
  content, so you can fill in as few or as many as you want per role.
  **Partner Overview** in particular is meant to be left blank for most roles.
- To write a bulleted list inside one of these cells, start each line with
  `-` and press **Alt+Enter** (Windows/ChromeOS) or **⌥+Return** (Mac) for a
  line break within the cell, instead of Enter (which would move to the next
  row). Plain paragraphs (no leading `-`) render as normal text.
- Column headers are matched loosely — "Job Title", "Team", "City", "Employment
  Type", "Date Posted", "Status", "Summary", "Apply URL", "Overview", "Duties",
  "Requirements", "Perks" and more all work too. See the `JOB_FIELD_ALIASES`
  map in `script.js` if you want to add more aliases.

To close a role, either set **Active** to `FALSE`/delete the row, or just delete
the row — no redeploy needed either way.

Note on navigation: the rest of this site is a single-page app (every "page"
is a `div` swapped by JavaScript, no real per-page URL — clicking "About Us"
or "FAQs" never changes the address bar). The Careers list and each job
detail page are the exception: they have real, shareable URLs —
`/careers` and `/careers/<slug>` (the slug is the job title, lowercased and
hyphenated, e.g. `/careers/land-acquisition-manager`). Those work as direct
links, survive a page refresh, and support the browser back/forward buttons.
This is implemented two ways together — see `vercel.json` (tells Vercel to
serve `index.html` for those paths instead of a 404) and the routing
functions in `script.js` (`navigateToCareers`, `navigateToJobDetail`,
`resolveRoute`) that read/write the URL client-side without a full reload.

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

The Apply button opens an on-page modal form (name, email, phone, a required
resume file, message). A resume link is not accepted: applicants must attach a
PDF, DOC or DOCX file of 5 MB or less.

The form posts to a small **Google Apps Script web app**
(`apps-script/ApplicationInbox.gs`) running in Lagom's Google account. For
each application it:

- saves the resume to a Drive folder called **Website Job Applications**
  (file name: date, role, applicant), so a copy is always kept, and
- emails **pete@lagomdevelopment.com** with the resume attached, subject
  "Website Application: <role>". Replying to the email replies to the applicant.

It's free. Apps Script can send about 100 emails a day from a regular Gmail
account, or 1,500 a day from Google Workspace.

### One-time setup

1. Sign in to the Google account that should own the resumes folder (ideally
   a Lagom Google Workspace account) and go to
   <https://script.google.com> → **New project**. Name it "Lagom application inbox".
2. Replace the contents of `Code.gs` with `apps-script/ApplicationInbox.gs`
   from this repo, and save.
3. Pick **setup** in the function dropdown and click **Run**. Approve the
   permissions it asks for (Drive and sending email). The log shows the new
   folder's link.
4. Click **Deploy → New deployment**, choose type **Web app**, set
   *Execute as* **Me** and *Who has access* **Anyone**, then **Deploy**.
   Copy the **Web app URL** (it ends in `/exec`).
5. In `script.js`, paste that URL into `APPLICATION_ENDPOINT`, bump the
   `script.js?v=` number in `index.html`, and push.
6. Send one test application with a resume and check that it reaches pete@ and
   the Drive folder.

To change who gets the emails, edit `NOTIFY_EMAIL` in the script, then
**Deploy → Manage deployments → Edit → New version** (the URL stays the same).
Any change to the script needs a new version this way to go live.

### Admin page for submitted applications

Every application is also logged to a Google Sheet, **Website Job Applications
log**, inside the resumes folder. The same script serves a private admin page
listing them: search, filter by status or role, open each resume, set a status
(New, Reviewing, Interview, Offer, Hired, Not a fit) and keep team notes.

Anyone signed in with an @lagomdevelopment.com Google account can view it; only
the addresses in `ADMIN_EMAILS` (gina@ and pete@) can change statuses and notes. Running
`setup` makes the resumes folder viewable by everyone at Lagom so they can open the files.

The admin page is its own deployment of the same script, so it gets its own URL:
**Deploy → New deployment → Web app**, *Execute as* **Me**, *Who has access*
**Anyone within Lagom Development**. Bookmark that URL. Keep the public
deployment (the one in `script.js`) as it is.

### Adding resumes received some other way

1. Put the files (PDF or Word) in the **Website Job Applications** Drive
   folder. From Gmail, use the attachment's "Add to Drive" button, then move it there.
2. In the Apps Script editor, choose **importResumes** and click **Run**. Each
   file not already in the log is added as **New**, named from its file name
   ("John_Smith_Resume.pdf" becomes "John Smith").
3. Open the log sheet and fill in the role, email and phone for those rows.
   The admin page shows the changes on **Refresh**.

No redeploy is needed: functions run from the editor always use the saved code.

If the endpoint is unreachable or not set, the form shows an inline error with
a direct email fallback rather than failing silently.

## Why not Airtable?

Airtable's API requires a personal access token on every request. Calling it
directly from this page would mean shipping that token in public page source —
anyone could read it from view-source and use it against your base. Doing
Airtable safely needs a small serverless proxy (e.g. a Cloudflare Worker or
Vercel function) to hide the token server-side. Google Sheets' "publish to
web" CSV is public-by-design and read-only, so it's safe to call directly from
the browser with no extra infrastructure. If you'd rather use Airtable anyway,
say so and I can build the proxy function.
