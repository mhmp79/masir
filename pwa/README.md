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

داخل پوشهٔ `pwa`:

```powershell
keytool -genkeypair -v -keystore android.keystore -alias android -keyalg RSA -keysize 2048 -validity 10000
```

این فایل را گم نکنید؛ برای آپدیت‌های بعدی Play Store لازم است.

### گام ۳: اثر انگشت و Digital Asset Links

```powershell
keytool -list -v -keystore android.keystore -alias android
```

مقدار `SHA256:` را کپی کنید و در `pwa/assetlinks.json` جای
`REPLACE_WITH_SHA256_CERT_FINGERPRINT` بگذارید. سپس فایل را در هاست قرار دهید:

```
https://YOUR-DOMAIN/.well-known/assetlinks.json
```

باید بدون ریدایرکت و با Content-Type برابر `application/json` باز شود. برای بررسی:

```
https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://YOUR-DOMAIN&relation=delegate_permission/common.handle_all_urls
```

### گام ۴: ساخت

داخل پوشهٔ `pwa`:

```powershell
bubblewrap build
```

خروجی‌ها:

- `app-release-signed.apk` برای تست روی گوشی
- `app-release-bundle.aab` برای Play Store

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
3. در `pwa/twa-manifest.json` مقدار `appVersionName` و `appVersionCode` را بالا ببرید.
4. دوباره `bubblewrap build` بزنید.

نسخهٔ PWA بعد از باز شدن مجدد، کش قدیمی را پاک و نسخهٔ جدید را فعال می‌کند.

---

## ۵) نکات مهم

- آیکون‌ها PNG واقعی ۱۹۲/۵۱۲ هستند؛ آیکون SVG قبلی برای نصب اندروید کافی نبود.
- فونت Vazirmatn داخل پروژه است (OFL)؛ هیچ درخواستی به Google Fonts زده نمی‌شود.
- PocketBase از فایل محلی `js/00-pocketbase.js` بارگذاری می‌شود؛ CDN حذف شده است.
- درخواست‌های PocketBase توسط Service Worker کش نمی‌شوند؛ فقط داده‌های محلی و پوستهٔ برنامه آفلاین می‌مانند.
- همگام‌سازی ابری اختیاری است. اپ بدون ورود و بدون اینترنت هم کامل کار می‌کند.
- فایل `android.keystore` و رمز آن را هرگز در مخزن عمومی یا هاست قرار ندهید.
