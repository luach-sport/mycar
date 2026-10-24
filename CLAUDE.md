# MyCar – הוראות לעבודה על הפרויקט

- האפליקציה: `www/` (HTML/JS, נארזת ל-APK עם Capacitor). כל push ל-main בונה APK, מפרסם Release ועדכון חתום שנכנס מתוך האפליקציה.
- **אתר ההסבר**: `site/index.html`, מתפרסם אוטומטית ב-https://luach-sport.github.io/mycar/ (`.github/workflows/site.yml`).
  - בכל שינוי באפליקציה שמוסיף, משנה או מוריד מסך, כפתור או יכולת, מעדכנים באותו commit גם את הפרק המתאים ב-`site/index.html` (הפתיח ורשימת הכפתורים).
  - צילומי המסך, מספר הגרסה ו"מה חדש" נוצרים לבד (`scripts/site-build.mjs`) מהאפליקציה עצמה ומ-`update.json`. לא מעלים צילומים ידנית.
- **מה חדש**: לפני כל גרסה כותבים את השינויים ב-`release-notes.txt` (שורה לכל שינוי, בשפה פשוטה). זה מוצג בחלון "גרסה חדשה" באפליקציה ובאתר.
- מספר גרסה: `APP_VERSION` ב-`.github/workflows/build.yml` (ובברירות המחדל ב-`scripts/prepare-web.mjs`, `scripts/make-update.mjs`, `www/js/core.js`).
- פניות מהאפליקציה נשלחות לסקריפט Google Apps Script של המפתח (`feedback/Code.gs`, הכתובת ב-`MC.FEEDBACK_URL`). כתובת המייל של המפתח לא נכנסת לקוד.
