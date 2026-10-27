// המייל שנשלח אליך: בכותרת שם האפליקציה, בגוף טבלה מסודרת, ו"השב" עונה ישירות לשולח.

function sendMail_(msg) {
  var rows = [
    ['אפליקציה', msg.app],
    ['שם השולח', msg.name],
    ['מייל השולח', msg.email],
    ['תאריך ושעה', msg.when],
    ['סוג הפנייה', msg.type],
    ['הפנייה', msg.message],
    ['גרסה', msg.version],
    ['מכשיר', msg.device]
  ].filter(function (r) { return r[1]; });

  MailApp.sendEmail({
    to: Session.getEffectiveUser().getEmail(),
    replyTo: msg.email,
    name: msg.app,
    subject: msg.app + ' – ' + msg.type + ' מ' + msg.name,
    body: emailText_(rows),
    htmlBody: emailHtml_(msg.app, rows)
  });
}

function emailText_(rows) {
  return rows.map(function (r) { return r[0] + ': ' + r[1]; }).join('\n');
}

function emailHtml_(app, rows) {
  var border = 'border:1px solid #DCE4F5;';
  var table = rows.map(function (r) {
    return '<tr>' +
      '<td style="background:#EEF3FE;font-weight:bold;white-space:nowrap;vertical-align:top;' + border + '">' + esc_(r[0]) + '</td>' +
      '<td style="white-space:pre-wrap;' + border + '">' + esc_(r[1]) + '</td>' +
      '</tr>';
  }).join('');
  return '<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px">' +
    '<h2 style="margin:0 0 12px">פנייה חדשה מהאפליקציה ' + esc_(app) + '</h2>' +
    '<table cellpadding="8" style="border-collapse:collapse">' + table + '</table>' +
    '<p style="color:#5B6577;font-size:13px">לחיצה על "השב" תענה ישירות לשולח.</p>' +
    '</div>';
}
