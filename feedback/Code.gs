// MyCar – פניות מהאפליקציה ישר ל-Gmail שלך. שולח מייל רק אליך.

// מפתח פשוט שמונע מבוטים כלליים לשלוח לכאן. אותו מפתח נמצא באפליקציה.
var APP_KEY = 'mc_9-ATPT_LPmYj188PGtCksaLh';
var MAX_PER_HOUR = 20;
var MAX_PER_DAY = 60;
var TYPES = { idea: 'הצעת ייעול', bug: 'תקלה', other: 'אחר' };

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || '';
    if (raw.length > 12000) return reply_({ ok: false, error: 'too-long' });
    var d = JSON.parse(raw);
    if (!d || d.key !== APP_KEY) return reply_({ ok: false, error: 'bad-key' });
    if (d.website) return reply_({ ok: true }); // שדה מלכודת לבוטים

    var name = clean_(d.name, 60);
    var email = clean_(d.email, 120);
    var message = clean_(d.message, 4000);
    var type = TYPES[d.type] || 'פנייה';
    if (name.length < 2 || message.length < 5 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return reply_({ ok: false, error: 'invalid' });
    }
    if (!allow_()) return reply_({ ok: false, error: 'rate-limit' });

    var when = clean_(d.when, 40) || Utilities.formatDate(new Date(), 'Asia/Jerusalem', 'd.M.yyyy HH:mm');
    var rows = [
      ['שם השולח', name],
      ['מייל השולח', email],
      ['תאריך ושעה', when],
      ['סוג הפנייה', type],
      ['הפנייה', message],
      ['גרסה', clean_(d.version, 40)],
      ['מכשיר', clean_(d.device, 40)]
    ];
    var html = '<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px">' +
      '<h2 style="margin:0 0 12px">פנייה חדשה מ-MyCar</h2>' +
      '<table cellpadding="8" style="border-collapse:collapse">' +
      rows.filter(function (r) { return r[1]; }).map(function (r) {
        return '<tr><td style="background:#EEF3FE;font-weight:bold;white-space:nowrap;vertical-align:top;border:1px solid #DCE4F5">' + esc_(r[0]) +
          '</td><td style="border:1px solid #DCE4F5;white-space:pre-wrap">' + esc_(r[1]) + '</td></tr>';
      }).join('') +
      '</table><p style="color:#5B6577;font-size:13px">לחיצה על "השב" תענה ישירות לשולח.</p></div>';
    var text = rows.filter(function (r) { return r[1]; }).map(function (r) { return r[0] + ': ' + r[1]; }).join('\n');

    MailApp.sendEmail({
      to: Session.getEffectiveUser().getEmail(),
      replyTo: email,
      name: 'MyCar',
      subject: 'MyCar – ' + type + ' מ' + name,
      body: text,
      htmlBody: html
    });
    return reply_({ ok: true });
  } catch (err) {
    console.error(err);
    return reply_({ ok: false, error: 'server' });
  }
}

function doGet() {
  return reply_({ ok: true, service: 'mycar-feedback' });
}

// הגבלת כמות, כדי שאף אחד לא יוכל להציף לך את המייל.
function allow_() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return false;
  try {
    var props = PropertiesService.getScriptProperties();
    var now = new Date();
    var hourKey = 'h' + Utilities.formatDate(now, 'Asia/Jerusalem', 'yyyyMMddHH');
    var dayKey = 'd' + Utilities.formatDate(now, 'Asia/Jerusalem', 'yyyyMMdd');
    var h = +(props.getProperty(hourKey) || 0), day = +(props.getProperty(dayKey) || 0);
    if (h >= MAX_PER_HOUR || day >= MAX_PER_DAY) return false;
    var keep = {};
    keep[hourKey] = String(h + 1);
    keep[dayKey] = String(day + 1);
    props.setProperties(keep, true);
    return true;
  } finally {
    lock.releaseLock();
  }
}

function clean_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}
function esc_(s) {
  return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
}
function reply_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
