# آماده‌سازی PWA و TWA — مسیر

این پوشه تنظیمات بسته‌بندی اندروید (TWA) را نگه می‌دارد. خودِ اپلیکیشن PWA در ریشهٔ پروژه است:

| فایل | نقش |
|---|---|
| `index.html` | ورودی PWA؛ فونت محلی و رابط ورود طراحی‌شدهٔ اپ |
| `manifest.json` | نام، آیکون‌ها، رنگ‌ها، `start_url` و `scope` |
| `sw.js` | پیش‌کش کامل برنامه برای اجرای آفلاین |
| `icons/` | آیکون‌های ۱۹۲، ۵۱۲، maskable و Apple |
| `fonts/` | فونت Vazirmatn + مجوز OFL |
| `js/13-sql-api.js` | تنها انتقالدهندهٔ محلی API سرور SQL (بدون CDN) |
| `js/12-sql-sync.js` | همگامسازی خودکار و نشست ورود |
| `js/14-auth-ui.js` | رابط ورود، ثبت نام، بازیابی و ابزار حساب |
| `js/15-widget-bridge.js` | ارسال عکس لحظهای داشبورد به ویجتهای بومی اندروید |
| `pwa/twa-manifest.json` | تنظیمات ساخت اپ اندروید با Bubblewrap |
| `pwa/widgets/` | منبع ویجتهای بومی (Java، XML و receiverها) |
| `pwa/install_widgets.py` | کپی منبع ویجتها به پروژهٔ تولیدشده توسط Bubblewrap |
| `pwa/assetlinks.json` | نمونهٔ Digital Asset Links برای Play Store |

---

## ۱) اجرای PWA

فایل‌ها را روی یک دامنهٔ **HTTPS** (یا `localhost`) سرو کنید. Service Worker از `file://` کار نمی‌کند.

برای تست محلی:

```powershell
cd "D:\Sync\Konkor\App\Versions\V0.9.4 - Beta"
python -m http.server 8765 --bind 127.0.0.1
```

سپس در Chrome باز کنید:

```
http://127.0.0.1:8765/
```

در DevTools → **Application** بررسی کنید:

- **Manifest**: بدون خطا، آیکون ۱۹۲ و ۵۱۲ و maskable دیده شود.
- **Service Workers**: وضعیت `activated` و `running`.
- **Cache Storage**: کش `konkur-shell-v1-0-9-5-r53` شامل همهٔ فایل‌ها باشد.

بعد از یک‌بار آنلاین شدن، **همهٔ امکانات برنامه آفلاین کار می‌کند**؛ فقط همگام‌سازی ابری به اینترنت نیاز دارد و در حالت آفلاین بی‌صدا صبر می‌کند.

> نصب و اولین اجرا نیاز به اینترنت دارد تا Service Worker فایل‌ها را ذخیره کند. از اجرای دوم به بعد، حتی بدون اینترنت باز می‌شود.

---

## ۲) انتشار روی هاست

این فایل‌ها/پوشه‌ها را در ریشهٔ سایت آپلود کنید:

```
index.html
manifest.json
sw.js
css/
js/
fonts/
icons/
```

نیازی به آپلود `server/`، `sql/`، `build.py`، `All in One.html` یا `pwa/` نیست.
`All in One.html` فقط برای اجرای تک‌فایلی روی سیستم است.

نکات هاست:

- HTTPS معتبر داشته باشد (بدون خطای گواهی).
- `sw.js` و `manifest.json` بدون ریدایرکت باز شوند.
- مسیرها نسبی‌اند؛ اجرا در زیرمسیر هم کار می‌کند، ولی `start_url`/`scope` همان زیرمسیر خواهد بود.
- فشرده‌سازی gzip/br برای CSS/JS فعال باشد (اختیاری، برای سرعت اولین نصب).

---

## ۳) ساخت اپ اندروید (TWA)

### پیش‌نیازها

- Node.js LTS
- JDK 17
- Android SDK (Bubblewrap خودش راهنمایی می‌کند)
- ابزار Bubblewrap:

```powershell
npm i -g @bubblewrap/cli
```

### گام ۱: تنظیم دامنه

تولید اکنون روی `https://masir.ir` است و `pwa/twa-manifest.json` و `pwa/app/build.gradle` با همان دامنه تنظیم شدهاند. API سرور SQL نیز همانمنشأ است و از مسیر `/api` فراخوانی میشود؛ مقداری در تنظیمات کاربر برای آدرس سرور وجود ندارد و اگر مقدار قدیمی ذخیرهای موجود باشد، روی `masir.ir` خودبهخود حذف میشود.

اگر دامنه را عوض کردید، این مقادیر را در `pwa/twa-manifest.json` بهروز کنید:

- `host`: دامنهٔ بدون `https://`
- `iconUrl` و `maskableIconUrl`
- `webManifestUrl`
- `fullScopeUrl`

همچنان باید همان دامنه را در `pwa/app/build.gradle` (`hostName`, `webManifestUrl`, `fullScopeUrl`) و `.well-known/assetlinks.json` منتشر کنید. اگر `packageId` را عوض کردید، همان را در `pwa/assetlinks.json` و `.well-known/assetlinks.json` هم بگذارید.

### گام ۲: کلید امضا

کلید امضا در همان پوشه ساخته شده است: `pwa/android.keystore` با alias برابر `android`.
رمز تصادفی آن در `pwa/.keystore.env` نگه داشته می‌شود (این فایل در `.gitignore` است و کامیت نمی‌شود).

**این دو فایل را جداگانه بک‌آپ بگیرید.** اگر کلید یا رمز گم شود، دیگر نمی‌توانید نسخهٔ جدید همان اپ را در Play Store منتشر کنید.

برای ساخت دوبارهٔ کلید (فقط اگر کلید قبلی را عمداً دور انداخته‌اید):

```powershell
keytool -genkeypair -v -keystore android.keystore -alias android -keyalg RSA -keysize 2048 -validity 10000 -storetype PKCS12
```

Bubblewrap می‌تواند رمز را از متغیرهای محیطی بخواند و سؤال رمز را نپرسد:

```powershell
Get-Content .keystore.env | ForEach-Object {
  $name, $value = $_ -split '=', 2
  Set-Item -Path "Env:$name" -Value $value
}
bubblewrap build
```

### گام ۳: اثر انگشت و Digital Asset Links

اثر انگشت این کلید در `pwa/assetlinks.json` ثبت شده است:

```
EE:E3:95:43:05:9C:55:2E:11:5C:D5:93:18:15:14:BB:0D:0C:B4:4A:DA:C7:63:57:52:FF:24:DC:E6:00:26:E7
```

اگر کلید را عوض کردید، اثر انگشت جدید را بگیرید:

```powershell
keytool -list -v -keystore android.keystore -alias android
```

مقدار `SHA256:` را در `pwa/assetlinks.json` و همچنین نسخهٔ منتشرشدهٔ `.well-known/assetlinks.json` در ریشهٔ پروژه جایگزین کنید. محل انتشار باید دقیقاً این باشد:

```
https://masir.ir/.well-known/assetlinks.json
```

فایل `pwa/assetlinks.json` فقط نسخهٔ مرجع است؛ چیزی که اندروید می‌خواند همان مسیر `.well-known` در ریشهٔ سایت است.

باید بدون ریدایرکت و با Content-Type برابر `application/json` باز شود. برای بررسی:

```
https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://masir.ir&relation=delegate_permission/common.handle_all_urls
```

### گام ۴: ساخت

داخل پوشهٔ `pwa`:

```powershell
bubblewrap update --skipVersionUpgrade
python install_widgets.py
bubblewrap build
```

اگر `bubblewrap update` را اجرا نکنید، `bubblewrap build` خودش می‌پرسد که پروژه بازسازی شود؛ جواب `y` بدهید و نسخه را تأیید کنید.

نکته‌های این محیط:

- پروژهٔ اندرویدِ تولیدشده (`app/`، `gradle/`، `build.gradle`، `gradlew` و…) در `.gitignore` است و هر بار با `bubblewrap update` از نو ساخته می‌شود. بعد از هر `bubblewrap update` حتماً `python install_widgets.py` را اجرا کنید تا هفت ویجت بومی دوباره نصب شوند.
- `minSdkVersion` روی ۲۴ است چون کتابخانهٔ `androidbrowserhelper:2.7.4` حداقل اندروید ۷ را می‌خواهد.
- اگر اینترنت این سیستم فقط از طریق پروکسی کار می‌کند، در `gradle.properties` این خطوط لازم است:

```
systemProp.http.proxyHost=127.0.0.1
systemProp.http.proxyPort=10808
systemProp.https.proxyHost=127.0.0.1
systemProp.https.proxyPort=10808
```

- قالب Bubblewrap از مخزن قدیمی `jcenter()` استفاده می‌کند؛ اگر بیلد با خطای مخزن متوقف شد، در `build.gradle` (هر دو بخش `buildscript` و `allprojects`) `jcenter()` را با `mavenCentral()` عوض کنید.

خروجی‌ها:

- `app-release-signed.apk` برای تست روی گوشی
- `app-release-bundle.aab` برای Play Store

آخرین بیلد موفق: نسخهٔ `0.9.5` (versionCode 2)، بستهٔ `app.masirkonkur.twa`، امضاشده با کلید `android` و اثر انگشت
`EE:E3:95:43:...:00:26:E7`.

### گام ۴ب: ویجتهای صفحهٔ اصلی اندروید

هفت ویجت بومی در پروژهٔ TWA تعریف شدهاند و هرکدام متناظر با یکی از کارتهای داشبورد وب است:

| ویجت | منبع داده |
|---|---|
| امروز و شمارش معکوس | آمار روز، روزهای مانده تا کنکور |
| پیشرفت هفته | درصد هدف هفتگی، ساعت و تست |
| روند مطالعه هفته | نمودار خطی هفت روز |
| هیتـمپ ماهانه | تقویم مطالعه ماه و روزهای فعال |
| سهم دروس | نمودار دایرهای دروس/آزمون |
| تراز آزمونها | روند تراز آخرین آزمونها |
| تگهای اشتباه | پراکندهترین تگهای اشتباه آزمونها |

دادهها از `collectDashboardSnapshot()` در `js/02-dashboard.js` میآیند و توسط `js/15-widget-bridge.js` در یک عکس لحظهای فشرده نگه داشته میشوند. داخل TWA، دکمهٔ «ویجتهای اندروید» در تنظیمات ← حساب و همگامسازی، این عکس را با یک Chrome intent به `WidgetSyncActivity` میفرستد؛ activity آن را در `SharedPreferences` ذخیره و همهٔ providerها را بهروزرسانی میکند. دادهها از IndexedDB میآیند و هیچ کپی ابری یا درخواست خارجی برای ویجتها وجود ندارد.

فایلهای پشتیبانی بومی در `pwa/widgets/` نگهداری میشوند و `python install_widgets.py` آنها را دوباره به `pwa/app/` کپی میکند و receiverهای مربوطه را بدون تکرار در manifest ثبت مینماید. بعد از هر تغییر در منبع وب، `python build.py` و بهروزرسانی کش `sw.js` را فراموش نکنید.

نکتهٔ ویندوز: مسیر JDK نباید فاصله داشته باشد، چون Bubblewrap دستور `apksigner` را بدون کوتیشن اجرا می‌کند و مسیرهایی مثل `C:\Program Files\...` شکست می‌خورند. راه‌حل: یک junction بسازید و همان را به Bubblewrap بدهید:

```powershell
cmd /c mklink /J "$env:USERPROFILE\jdk17" "C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"
bubblewrap updateConfig --jdkPath "$env:USERPROFILE\jdk17"
```

همچنین JDK باید ۶۴ بیتی باشد؛ نسخهٔ ۳۲ بیتیِ دانلودی Bubblewrap نمی‌تواند heap گریدل را رزرو کند.

اگر Bubblewrap از شما خواست `twa-manifest.json` بسازد، همان فایل آمادهٔ این پوشه را نگه دارید و مقادیر را تأیید کنید.

### گام ۵: تست آفلاین

1. اپ را یک‌بار با اینترنت باز کنید تا Service Worker نصب شود.
2. اینترنت را قطع کنید.
3. اپ را از آیکون گوشی باز کنید. باید کامل بالا بیاید و داده‌های محلی (IndexedDB) در دسترس باشند.

---

## ۴) به‌روزرسانی نسخه

بعد از هر تغییر در `index.html`، `css/` یا `js/`:

1. مقدار `CACHE_NAME` در `sw.js` را بالا ببرید (مثلاً `konkur-shell-v1-0-9-5`).
2. `version` در `manifest.json` را به‌روز کنید.
3. در `pwa/twa-manifest.json` مقدار `appVersion` و `appVersionCode` را بالا ببرید (کلید نام نسخه `appVersion` است، نه `appVersionName`).
4. دوباره `bubblewrap build` بزنید.

نسخهٔ PWA بعد از باز شدن مجدد، کش قدیمی را پاک و نسخهٔ جدید را فعال می‌کند.

---

## ۵) نکات مهم

- آیکون‌ها PNG واقعی ۱۹۲/۵۱۲ هستند؛ آیکون SVG قبلی برای نصب اندروید کافی نبود.
- فونت Vazirmatn داخل پروژه است (OFL)؛ هیچ درخواستی به Google Fonts زده نمی‌شود.
- تمام CSS/JS محلیاند و هیچ اسکریپت CDN در زمان اجرا وجود ندارد.
- ورود با شماره تلفن و رمز عبور است؛ کد پیامک فقط برای ثبت نام و بازیابی رمز استفاده میشود.
- درخواست‌های سرور SQL توسط Service Worker کش نمی‌شوند؛ فقط داده‌های محلی و پوستهٔ برنامه آفلاین می‌مانند.
- همگامسازی ابری همیشه خودکار است و دکمهای برای آن وجود ندارد. اپ با صفحهٔ ورود تمامصفحه آغاز میشود؛ پس از ورود، دادهها محلی ذخیره میشوند و همگامسازی خودکار ادامه مییابد.
- فایل `android.keystore` و `pwa/.keystore.env` را هرگز در مخزن عمومی یا هاست قرار ندهید. کلید فعلی با رمز تصادفی ساخته شده و اثر انگشتش در `pwa/assetlinks.json` ثبت است.
