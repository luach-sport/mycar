// עזרים קטנים: ניקוי טקסט, בדיקת מייל, הגנה על HTML, ותשובה לאפליקציה.

// מסיר תווים בלתי נראים ומקצר לאורך המותר.
function clean_(value, max) {
  return String(value == null ? '' : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

function isEmail_(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

// טקסט בטוח בתוך המייל (בלי קוד HTML מהשולח).
function esc_(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// התשובה שהאפליקציה מקבלת, למשל { ok: true }.
function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
