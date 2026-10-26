/**
 * Lagom careers — application inbox (Google Apps Script web app).
 *
 * Receives the careers-page application form, saves the resume to a Drive
 * folder and emails it to NOTIFY_EMAIL as an attachment. See CAREERS-SETUP.md
 * ("How applications are delivered") for deployment steps.
 */

const NOTIFY_EMAIL = 'gina@lagomdevelopment.com';
const FOLDER_NAME = 'Website Job Applications';
const MAX_BYTES = 5 * 1024 * 1024;
const RESUME_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

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

    const stamp = Utilities.formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd HHmm');
    const fileName = `${stamp} - ${position} - ${name}.${ext}`.replace(/[\\/:*?"<>|]/g, '-');
    const blob = Utilities.newBlob(bytes, RESUME_TYPES[ext], fileName);
    const file = applicationsFolder().createFile(blob);

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

/** Run once from the Apps Script editor to grant permissions and create the folder. */
function setup() {
  const folder = applicationsFolder();
  console.log('Resumes will be saved to: ' + folder.getUrl());
  console.log('Emails left today: ' + MailApp.getRemainingDailyQuota());
}

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

function clean(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
