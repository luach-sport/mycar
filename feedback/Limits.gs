// הגבלת כמות: עד MAX_PER_HOUR פניות בשעה ו-MAX_PER_DAY ביום, כדי שאף אחד לא יוכל להציף לך את המייל.

function allow_() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return false;
  try {
    var props = PropertiesService.getScriptProperties();
    var now = new Date();
    var hourKey = 'h' + Utilities.formatDate(now, 'Asia/Jerusalem', 'yyyyMMddHH');
    var dayKey = 'd' + Utilities.formatDate(now, 'Asia/Jerusalem', 'yyyyMMdd');
    var inHour = +(props.getProperty(hourKey) || 0);
    var inDay = +(props.getProperty(dayKey) || 0);
    if (inHour >= MAX_PER_HOUR || inDay >= MAX_PER_DAY) return false;

    var keep = {};
    keep[hourKey] = String(inHour + 1);
    keep[dayKey] = String(inDay + 1);
    props.setProperties(keep, true); // שומר רק את המונים של השעה והיום הנוכחיים
    return true;
  } finally {
    lock.releaseLock();
  }
}
