# آماده‌سازی PWA و TWA — مسیر کنکور

این پوشه تنظیمات بسته‌بندی اندروید (TWA) را نگه می‌دارد. خودِ اپلیکیشن PWA در ریشهٔ پروژه است:

| فایل | نقش |
|---|---|
| `index.html` | ورودی PWA؛ فونت و PocketBase محلی |
| `manifest.json` | نام، آیکون‌ها، رنگ‌ها، `start_url` و `scope` |
| `sw.js` | پیش‌کش کامل برنامه برای اجرای آفلاین |
| `icons/` | آیکون‌های ۱۹۲، ۵۱۲، maskable و Apple |
| `fonts/` | فونت Vazirmatn + مجوز OFL |
| `js/00-pocketbase.js` | نسخهٔ محلی PocketBase (بدون CDN) |
| `pwa/twa-manifest.json` | تنظیمات ساخت اپ اندروید با Bubblewrap |
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
- **Cache Storage**: کش `konkur-shell-v1-0-9-4-r2` شامل همهٔ فایل‌ها باشد.

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

نیازی به آپلود `pocketbase/`، `build.py`، `All in One.html` یا `pwa/` نیست.
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

در `pwa/twa-manifest.json` این مقادیر را عوض کنید:

- `host`: دامنهٔ بدون `https://` — مثلاً `app.example.com`
- `packageId`: شناسهٔ یکتای اپ — مثلاً `ir.example.konkur`
- `iconUrl` و `maskableIconUrl`
- `webManifestUrl`
- `fullScopeUrl`

اگر `packageId` را عوض کردید، همان را در `pwa/assetlinks.json` هم بگذارید.

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
https://masir-konkour.vercel.app/.well-known/assetlinks.json
```

فایل `pwa/assetlinks.json` فقط نسخهٔ مرجع است؛ چیزی که اندروید می‌خواند همان مسیر `.well-known` در ریشهٔ سایت است.

باید بدون ریدایرکت و با Content-Type برابر `application/json` باز شود. برای بررسی:

```
https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://masir-konkour.vercel.app&relation=delegate_permission/common.handle_all_urls
```

### گام ۴: ساخت

داخل پوشهٔ `pwa`:

```powershell
bubblewrap update --skipVersionUpgrade
bubblewrap build
```

اگر `bubblewrap update` را اجرا نکنید، `bubblewrap build` خودش می‌پرسد که پروژه بازسازی شود؛ جواب `y` بدهید و نسخه را تأیید کنید.

نکته‌های این محیط:

- پروژهٔ اندرویدِ تولیدشده (`app/`، `gradle/`، `build.gradle`، `gradlew` و…) در `.gitignore` است و هر بار با `bubblewrap update` از نو ساخته می‌شود.
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

آخرین بیلد موفق: نسخهٔ `0.9.4` (versionCode 1)، بستهٔ `app.masirkonkur.twa`، امضاشده با کلید `android` و اثر انگشت
`EE:E3:95:43:...:00:26:E7`.

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
- PocketBase از فایل محلی `js/00-pocketbase.js` بارگذاری می‌شود؛ CDN حذف شده است.
- درخواست‌های PocketBase توسط Service Worker کش نمی‌شوند؛ فقط داده‌های محلی و پوستهٔ برنامه آفلاین می‌مانند.
- همگام‌سازی ابری اختیاری است. اپ بدون ورود و بدون اینترنت هم کامل کار می‌کند.
- فایل `android.keystore` و `pwa/.keystore.env` را هرگز در مخزن عمومی یا هاست قرار ندهید. کلید فعلی با رمز تصادفی ساخته شده و اثر انگشتش در `pwa/assetlinks.json` ثبت است.
