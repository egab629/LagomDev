/**
 * Lagom pricing requests — contract homebuilding / panel kit (Google Apps Script web app).
 *
 * POST (from the "Request pricing" form on the model pages): logs the request
 * to a Google Sheet and emails a notification to NOTIFY_EMAIL.
 * Deploy as a web app (Execute as: Me, Access: Anyone), then paste the /exec URL
 * into PRICING_ENDPOINT in script.js. Run setup() once to grant permissions.
 */

const NOTIFY_EMAIL = 'via@lagomdevelopment.com';
const LOG_NAME = 'Lagom Pricing Requests';
const TYPES = ['Contract homebuilding', 'Panel kit', 'Both'];
const MODELS = ['Model 1', 'Model 2', 'Model 3', 'Model 4', 'Model 5', 'Not sure yet'];
const STATES = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN',
  'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM',
  'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV',
  'WI', 'WY'];
const LOG_HEADERS = ['ID', 'Submitted', 'Type', 'Model', 'Name', 'Email', 'Phone', 'City', 'State', 'ZIP', 'Notes'];

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.botcheck) return json({ success: true }); // honeypot tripped — drop quietly

    const v = {
      Type: clean(body.type, 50), Model: clean(body.model, 50), Name: clean(body.name, 200),
      Email: clean(body.email, 200).toLowerCase(), Phone: clean(body.phone, 40), City: clean(body.city, 100),
      State: clean(body.state, 2).toUpperCase(), ZIP: clean(body.zip, 10), Notes: clean(body.notes, 1000),
    };
    if (!TYPES.includes(v.Type)) throw new Error('Please choose the pricing you want.');
    if (!MODELS.includes(v.Model)) throw new Error('Please choose a Lagom model.');
    if (!v.Name) throw new Error('Please enter your name.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.Email)) throw new Error('Please enter a valid email address.');
    if (!v.City) throw new Error('Please enter the build site city.');
    if (!STATES.includes(v.State)) throw new Error('Please choose a state.');
    if (!/^\d{5}(-\d{4})?$/.test(v.ZIP)) throw new Error('Please enter a valid ZIP code.');

    withLock(() => {
      const sheet = logSheet();
      const row = { ID: Utilities.getUuid(), Submitted: new Date() };
      LOG_HEADERS.forEach((h) => { if (h in v) row[h] = h === 'ZIP' ? "'" + v[h] : safeCell(v[h]); });
      sheet.appendRow(sheet.getDataRange().getValues()[0].map((h) => (h in row ? row[h] : '')));
    });

    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      replyTo: v.Email,
      subject: 'Pricing request: ' + v.Type + ' — ' + v.Model,
      body: LOG_HEADERS.slice(2).map((h) => h + ': ' + v[h]).join('\n'),
    });
    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ success: false, message: String((err && err.message) || err) });
  }
}

/** Run once from the Apps Script editor: grants permissions and creates the sheet. */
function setup() {
  console.log('Pricing requests sheet: ' + logSheet().getParent().getUrl());
}

function logSheet() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('LOG_SHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id).getSheets()[0]; } catch (e) { /* deleted — make a new one */ }
  }
  const ss = SpreadsheetApp.create(LOG_NAME);
  const sheet = ss.getSheets()[0];
  sheet.setName('Requests');
  sheet.appendRow(LOG_HEADERS);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, LOG_HEADERS.length).setFontWeight('bold');
  sheet.getRange('J:J').setNumberFormat('@'); // keep leading zeros in ZIP codes
  props.setProperty('LOG_SHEET_ID', ss.getId());
  return sheet;
}

function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function clean(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

/** Stop request text such as "=HYPERLINK(...)" being run as a spreadsheet formula. */
function safeCell(value) {
  const s = String(value == null ? '' : value);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
