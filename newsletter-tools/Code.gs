/**
 * Dr Hardman newsletter: sends the HTML newsletter from your own Gmail to the people who
 * signed up on drhardman.fi (newsletter/subscribe.php keeps the list on the server).
 *
 * Setup (once): see README.md in this folder. In short: a new Google Sheet → Extensions →
 * Apps Script → paste this file as Code.gs and the two templates as HTML files named
 * uutiskirje_fi and nyhetsbrev_sv → reload the sheet → menu Newsletter → Set export address.
 *
 * Each round: edit the templates (the <title> is the subject line) → Newsletter →
 * 1. Fetch subscribers → 2. Send test to me → 3. Send newsletter.
 * Gmail allows about 100 recipients a day from a script (1,500 with Google Workspace).
 * If the list is longer, run "3. Send newsletter" again the next day; it continues where it
 * stopped. "Start a new round" clears the Sent column for the next newsletter.
 */

const SHEET_NAME = 'Subscribers';
const SENDER_NAME = 'Dr Hardman';
const TEMPLATES = { fi: 'uutiskirje_fi', sv: 'nyhetsbrev_sv' };
const HEADERS = ['email', 'lang', 'unsubscribe_url', 'sent'];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Newsletter')
    .addItem('1. Fetch subscribers from drhardman.fi', 'fetchSubscribers')
    .addItem('2. Send test to me (both languages)', 'sendTest')
    .addItem('3. Send newsletter', 'sendNewsletter')
    .addSeparator()
    .addItem('Start a new round (clear Sent)', 'startNewRound')
    .addItem('Set export address', 'setExportUrl')
    .addToUi();
}

/** Saves the secret export address (https://drhardman.fi/newsletter/export.php?key=…). */
function setExportUrl() {
  const ui = SpreadsheetApp.getUi();
  const answer = ui.prompt('Export address', 'Paste https://drhardman.fi/newsletter/export.php?key=…', ui.ButtonSet.OK_CANCEL);
  if (answer.getSelectedButton() !== ui.Button.OK) return;
  const url = answer.getResponseText().trim();
  if (!/^https:\/\/[^ ]+export\.php\?key=\S{20,}$/.test(url)) {
    ui.alert('That does not look like the export address.');
    return;
  }
  PropertiesService.getScriptProperties().setProperty('EXPORT_URL', url);
  ui.alert('Saved.');
}

/**
 * Replaces the sheet with the current list from the server. Rows that were already sent in
 * this round keep their Sent time, so a round can continue after fetching again.
 */
function fetchSubscribers() {
  const ui = SpreadsheetApp.getUi();
  const url = PropertiesService.getScriptProperties().getProperty('EXPORT_URL');
  if (!url) {
    ui.alert('Set the export address first (Newsletter → Set export address).');
    return;
  }
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) {
    ui.alert('Could not fetch the list (HTTP ' + response.getResponseCode() + '). Check the export address.');
    return;
  }
  const rows = Utilities.parseCsv(response.getContentText('UTF-8')).slice(1).filter(r => r.length >= 3 && r[0]);

  const sheet = getSheet_();
  const sentBefore = {};
  readRows_(sheet).forEach(r => { if (r.sent) sentBefore[r.email] = r.sent; });

  sheet.clearContents();
  const values = [HEADERS].concat(rows.map(r => [r[0], r[1], r[2], sentBefore[r[0]] || '']));
  sheet.getRange(1, 1, values.length, HEADERS.length).setValues(values);
  sheet.setFrozenRows(1);

  const fi = rows.filter(r => r[1] === 'fi').length;
  ui.alert(rows.length + ' subscribers (' + fi + ' Finnish, ' + (rows.length - fi) + ' Swedish).');
}

/** Sends both language versions to yourself. */
function sendTest() {
  const me = Session.getEffectiveUser().getEmail();
  ['fi', 'sv'].forEach(lang => sendOne_(me, lang, 'https://drhardman.fi/newsletter/unsubscribe.php?l=' + lang));
  SpreadsheetApp.getUi().alert('Test emails sent to ' + me + '. The unsubscribe link in a test email does not work.');
}

/** Sends to everyone without a Sent time, as far as today's Gmail quota allows. */
function sendNewsletter() {
  const ui = SpreadsheetApp.getUi();
  const sheet = getSheet_();
  const pending = readRows_(sheet).filter(r => r.email && !r.sent);
  if (pending.length === 0) {
    ui.alert('Everyone on the list has already got this newsletter. Fetch subscribers, or start a new round for the next newsletter.');
    return;
  }
  const quota = MailApp.getRemainingDailyQuota();
  const now = Math.min(quota, pending.length);
  const ok = ui.alert('Send the newsletter?',
    pending.length + ' recipients waiting. Gmail allows ' + quota + ' more today, so ' + now + ' will be sent now' +
    (now < pending.length ? ' and the rest when you run this again tomorrow.' : '.'),
    ui.ButtonSet.OK_CANCEL);
  if (ok !== ui.Button.OK) return;

  let sent = 0;
  const failed = [];
  for (const r of pending.slice(0, now)) {
    try {
      sendOne_(r.email, r.lang, r.unsubscribe_url);
      sheet.getRange(r.row, 4).setValue(new Date());
      sent++;
    } catch (e) {
      failed.push(r.email + ': ' + e.message);
    }
  }
  SpreadsheetApp.flush();
  ui.alert(sent + ' sent.' +
    (pending.length - sent - failed.length > 0 ? ' ' + (pending.length - sent - failed.length) + ' left for tomorrow.' : '') +
    (failed.length ? '\n\nNot sent:\n' + failed.join('\n') : ''));
}

/** Clears the Sent column before sending a new newsletter. */
function startNewRound() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('Start a new round?', 'This clears the Sent column so everyone gets the next newsletter.', ui.ButtonSet.OK_CANCEL) !== ui.Button.OK) return;
  const sheet = getSheet_();
  if (sheet.getLastRow() > 1) sheet.getRange(2, 4, sheet.getLastRow() - 1, 1).clearContent();
}

function sendOne_(to, lang, unsubscribeUrl) {
  const template = HtmlService.createTemplateFromFile(TEMPLATES[lang === 'fi' ? 'fi' : 'sv']);
  template.unsubscribeUrl = unsubscribeUrl;
  const html = template.evaluate().getContent();
  const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || 'Dr Hardman';
  GmailApp.sendEmail(to, decode_(title.trim()), toPlainText_(html), { htmlBody: html, name: SENDER_NAME });
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

function readRows_(sheet) {
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues()
    .map((v, i) => ({ row: i + 2, email: String(v[0]).trim(), lang: v[1], unsubscribe_url: v[2], sent: v[3] }));
}

/** Plain-text version for mail programs that don't show HTML. */
function toPlainText_(html) {
  return decode_(html
    .replace(/<(style|title|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<\/(p|h1|h2|h3|tr|li)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim());
}

function decode_(s) {
  return s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&ndash;/g, '–').replace(/&euro;/g, '€').replace(/&middot;/g, '·');
}
