# MyCar – הוראות לעבודה על הפרויקט

- האפליקציה: `www/` (HTML/JS, נארזת ל-APK עם Capacitor). כל push ל-main בונה APK, מפרסם Release ועדכון חתום שנכנס מתוך האפליקציה.
- **אתר ההסבר**: https://luach-sport.github.io/mycar/ (`.github/workflows/site.yml`, לענף `gh-pages`).
  - בנוי מהערכה המשותפת של כל האתרים של Itzko: הריפו `luach-sport/itzko`, תיקיית `kit/` (שלד, קרדיט בולט, "עוד אפליקציות של Itzko", כפתור שיתוף האתר, עיצוב משותף). ה-workflow מוריד אותה ל-`.kit`.
  - כאן רק מה ששייך ל-MyCar: `site/site.json` (כותרת, סדר החלקים, טקסט הקרדיט), `site/parts/` (פרק לכל מסך, `offline` = מה עובד בלי אינטרנט), `site/css/brand.css` (צבעים).
  - בכל שינוי באפליקציה שמוסיף, משנה או מוריד מסך, כפתור או יכולת, מעדכנים באותו commit גם את הפרק המתאים ב-`site/parts/` (הפתיח ורשימת הכפתורים).
  - צילומי המסך, מספר הגרסה ו"מה חדש" נוצרים לבד (`scripts/site/scenes.mjs` קובע מה מצולם ועם אילו נתונים לדוגמה) מהאפליקציה עצמה ומ-`update.json`. לא מעלים צילומים ידנית.
  - נבנה מחדש בכל שינוי באתר או באפליקציה, אחרי כל גרסה חדשה (`build.yml` מפעיל אותו), ופעם ביום. מקומית: `CHROME=… node <itzko>/kit/lib/build.mjs`.
- **שיתוף האפליקציה** (`www/js/share-app.js`, נטען אחרי `app.js`): קישור לאתר עם הודעה קצרה, או קובץ ה-APK המותקן (נמצא דרך `/proc/self/maps`, ואם לא, יורד מ-GitHub). בדיקה: `tests/share-app.test.mjs`.
- **מה חדש**: לפני כל גרסה כותבים את השינויים ב-`release-notes.txt` (שורה לכל שינוי, בשפה פשוטה). זה מוצג בחלון "גרסה חדשה" באפליקציה ובאתר.
- מספר גרסה: `APP_VERSION` ב-`.github/workflows/build.yml` (ובברירות המחדל ב-`scripts/prepare-web.mjs`, `scripts/make-update.mjs`, `www/js/core.js`).
- פניות מהאפליקציה נשלחות לסקריפט Google Apps Script של המפתח (`feedback/`: קובץ לכל חלק – `Settings`, `Main`, `Message`, `Email`, `Limits`, `Helpers`; אותו סקריפט משרת גם את שמרתי. הכתובת ב-`MC.FEEDBACK_URL`). כתובת המייל של המפתח לא נכנסת לקוד.
