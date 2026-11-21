/* ============================================================
   SERVICE WORKER — مسیر کنکور
   همهٔ فایل‌های برنامه از قبل ذخیره می‌شوند تا بعد از نصب،
   اجرای کامل آفلاین باشد. درخواست‌های PocketBase و دامنه‌های
   بیرونی اصلاً کش نمی‌شوند و مستقیم به شبکه می‌روند.

   بعد از هر تغییر در فایل‌های برنامه، CACHE_NAME را یک نسخه
   بالا ببرید تا نسخهٔ جدید جایگزین شود.
   ============================================================ */

'use strict';

const CACHE_NAME = 'konkur-shell-v1-0-9-5-r31';
const ROOT_URL = new URL('./', self.location.href).href;
const OFFLINE_URL = new URL('index.html', ROOT_URL).href;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/favicon-32.png',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './fonts/Vazirmatn-Variable.woff2',
  './css/01-base.css',
  './css/02-typography.css',
  './css/03-buttons.css',
  './css/04-forms.css',
  './css/05-overlays.css',
  './css/06-dashboard.css',
  './css/07-plan.css',
  './css/08-activity.css',
  './css/09-exam.css',
  './css/10-overview.css',
  './css/11-class.css',
  './css/12-settings.css',
  './css/13-reports.css',
  './css/14-desktop.css',
  './css/15-utilities.css',
  './js/00-pocketbase.js',
  './js/00-utils.js',
  './js/01-core.js',
  './js/02-dashboard.js',
  './js/03-plan.js',
  './js/04-activity.js',
  './js/05-exam.js',
  './js/06-overview.js',
  './js/07-class.js',
  './js/08-settings.js',
  './js/09-reports.js',
  './js/10-timer.js',
  './js/11-backup.js',
  './js/12-pocketbase.js',
  './js/99-init.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  /* PocketBase و هر دامنهٔ بیرونی: بدون کش، فقط شبکه */
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw.js')) return;

  /* باز کردن برنامه: همیشه پوستهٔ ذخیره‌شده، حتی بدون اینترنت */
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(OFFLINE_URL).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(OFFLINE_URL, copy));
          }
          return response;
        });
      }).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }).catch(() => caches.match(request).then((fallback) => fallback || Response.error()))
  );
});
