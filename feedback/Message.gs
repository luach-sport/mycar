// קריאת הפנייה שהגיעה ובדיקה שהיא תקינה.
// מחזיר את הפנייה מסודרת, או null אם חסר שם, מייל תקין או תוכן.

function readMessage_(data) {
  var msg = {
    app: APPS[data.app] || DEFAULT_APP,
    type: TYPES[data.type] || 'פנייה',
    name: clean_(data.name, 60),
    email: clean_(data.email, 120),
    message: clean_(data.message, 4000),
    when: clean_(data.when, 40) || Utilities.formatDate(new Date(), 'Asia/Jerusalem', 'd.M.yyyy HH:mm'),
    version: clean_(data.version, 40),
    device: clean_(data.device, 40)
  };
  if (msg.name.length < 2 || msg.message.length < 5 || !isEmail_(msg.email)) return null;
  return msg;
}
