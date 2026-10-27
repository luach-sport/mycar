// נקודות הכניסה: האפליקציות שולחות לכאן פנייה (doPost). פתיחת הכתובת בדפדפן (doGet) מראה שהשירות עובד.

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || '';
    if (raw.length > 12000) return reply_({ ok: false, error: 'too-long' });

    var data = JSON.parse(raw);
    if (!data || data.key !== APP_KEY) return reply_({ ok: false, error: 'bad-key' });
    if (data.website) return reply_({ ok: true }); // שדה מלכודת לבוטים

    var msg = readMessage_(data);
    if (!msg) return reply_({ ok: false, error: 'invalid' });
    if (!allow_()) return reply_({ ok: false, error: 'rate-limit' });

    sendMail_(msg);
    return reply_({ ok: true });
  } catch (err) {
    console.error(err);
    return reply_({ ok: false, error: 'server' });
  }
}

function doGet() {
  return reply_({ ok: true, service: 'itzko-feedback', apps: Object.keys(APPS) });
}
